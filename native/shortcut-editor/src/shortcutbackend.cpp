// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#include "shortcutbackend.h"

#include <KGlobalAccel>
#include <KGlobalShortcutInfo>

#include <QCollator>
#include <QDBusInterface>
#include <QDBusMetaType>
#include <QDBusObjectPath>
#include <QDBusReply>
#include <QHash>
#include <QSet>
#include <QVariant>

#include <algorithm>
#include <utility>

namespace
{
constexpr auto serviceName = "org.kde.kglobalaccel";
constexpr auto rootPath = "/kglobalaccel";
constexpr auto rootInterface = "org.kde.KGlobalAccel";
constexpr auto componentInterface = "org.kde.kglobalaccel.Component";
constexpr auto actionPrefix = "driftile_";
constexpr auto kwinComponentName = "kwin";

QString dbusError(const QDBusError &error, const QString &operation)
{
    const QString detail = error.message().isEmpty() ? error.name() : error.message();
    return QStringLiteral("%1 failed: %2").arg(operation, detail);
}

QString ownerDescription(const KGlobalShortcutInfo &owner)
{
    const QString action = owner.friendlyName().isEmpty() ? owner.uniqueName() : owner.friendlyName();
    const QString component = owner.componentFriendlyName().isEmpty() ? owner.componentUniqueName() : owner.componentFriendlyName();
    return QStringLiteral("%1 (%2)").arg(action, component);
}

bool finalOwnerStillConflicts(
    const KGlobalShortcutInfo &owner,
    const QKeySequence &candidate,
    const QHash<QString, const ShortcutAction *> &actionsByKey)
{
    const auto iterator = actionsByKey.constFind(actionKey(owner.componentUniqueName(), owner.uniqueName()));
    if (iterator == actionsByKey.cend()) {
        return true;
    }

    for (const QKeySequence &sequence : iterator.value()->edited) {
        if (sequencesConflict(candidate, sequence)) {
            return true;
        }
    }

    return false;
}
}

ShortcutBackend::ShortcutBackend(QDBusConnection connection)
    : m_connection(std::move(connection))
{
    qDBusRegisterMetaType<QKeySequence>();
    qDBusRegisterMetaType<QList<QKeySequence>>();
    qDBusRegisterMetaType<KGlobalShortcutInfo>();
    qDBusRegisterMetaType<QList<KGlobalShortcutInfo>>();
}

ShortcutBackend::LoadResult ShortcutBackend::loadActions() const
{
    if (!m_connection.isConnected()) {
        return {
            .actions = {},
            .componentUniqueName = {},
            .error = QStringLiteral("The session D-Bus connection is unavailable."),
        };
    }

    QDBusInterface root(serviceName, rootPath, rootInterface, m_connection);
    if (!root.isValid()) {
        return {
            .actions = {},
            .componentUniqueName = {},
            .error = QStringLiteral("KGlobalAccel is unavailable on the session bus."),
        };
    }

    const QDBusReply<QList<QDBusObjectPath>> components = root.call(QStringLiteral("allComponents"));
    if (!components.isValid()) {
        return {
            .actions = {},
            .componentUniqueName = {},
            .error = dbusError(components.error(), QStringLiteral("KGlobalAccel component discovery")),
        };
    }

    QList<ShortcutAction> actions;
    QString activeComponent;
    QSet<QString> seenActions;
    bool activeKWinFound = false;

    for (const QDBusObjectPath &path : components.value()) {
        QDBusInterface component(serviceName, path.path(), componentInterface, m_connection);
        if (!component.isValid()) {
            continue;
        }

        const QString componentUniqueName = component.property("uniqueName").toString();
        if (componentUniqueName != QLatin1String(kwinComponentName)) {
            continue;
        }

        const QDBusReply<bool> active = component.call(QStringLiteral("isActive"));
        if (!active.isValid() || !active.value()) {
            continue;
        }
        activeKWinFound = true;
        activeComponent = componentUniqueName;

        const QDBusReply<QList<KGlobalShortcutInfo>> infos = component.call(QStringLiteral("allShortcutInfos"));
        if (!infos.isValid()) {
            return {
                .actions = {},
                .componentUniqueName = {},
                .error = dbusError(infos.error(), QStringLiteral("Reading active KWin shortcut metadata")),
            };
        }

        for (const KGlobalShortcutInfo &info : infos.value()) {
            if (info.componentUniqueName() != componentUniqueName
                || !info.uniqueName().startsWith(QLatin1String(actionPrefix))) {
                continue;
            }

            const QString key = actionKey(info.componentUniqueName(), info.uniqueName());
            if (seenActions.contains(key)) {
                continue;
            }

            seenActions.insert(key);

            ShortcutAction action;
            action.dbusId = {
                info.componentUniqueName(),
                info.uniqueName(),
                info.componentFriendlyName(),
                info.friendlyName(),
            };
            action.uniqueName = info.uniqueName();
            action.friendlyName = info.friendlyName().isEmpty() ? info.uniqueName() : info.friendlyName();

            QString error;
            action.baseline = shortcutKeys(action.dbusId, &error);
            if (!error.isEmpty()) {
                return {
                    .actions = {},
                    .componentUniqueName = {},
                    .error = error,
                };
            }

            action.edited = action.baseline;
            actions.append(std::move(action));
        }
    }

    if (!activeKWinFound) {
        return {
            .actions = {},
            .componentUniqueName = {},
            .error = QStringLiteral("The active KWin global shortcut component was not found."),
        };
    }

    if (actions.isEmpty()) {
        return {
            .actions = {},
            .componentUniqueName = {},
            .error = QStringLiteral("No active Driftile shortcut actions were found. Enable the KWin extension first."),
        };
    }

    QCollator collator;
    collator.setCaseSensitivity(Qt::CaseInsensitive);
    collator.setNumericMode(true);
    std::sort(actions.begin(), actions.end(), [&collator](const ShortcutAction &left, const ShortcutAction &right) {
        return collator.compare(left.friendlyName, right.friendlyName) < 0;
    });

    return {
        .actions = std::move(actions),
        .componentUniqueName = activeComponent,
        .error = {},
    };
}

ShortcutBackend::OperationResult ShortcutBackend::validate(const QList<ShortcutAction> &actions) const
{
    QHash<QString, const ShortcutAction *> actionsByKey;
    for (const ShortcutAction &action : actions) {
        actionsByKey.insert(actionKey(action), &action);
    }

    struct Assignment
    {
        const ShortcutAction *action;
        QKeySequence sequence;
        bool changed;
    };
    QList<Assignment> assignments;

    for (const ShortcutAction &action : actions) {
        const bool changed = !sequenceListsEqual(action.baseline, action.edited);
        for (const QKeySequence &sequence : action.edited) {
            if (!sequence.isEmpty()) {
                assignments.append({&action, sequence, changed});
            }
        }
    }

    for (qsizetype leftIndex = 0; leftIndex < assignments.size(); ++leftIndex) {
        const Assignment &left = assignments.at(leftIndex);
        for (qsizetype rightIndex = leftIndex + 1; rightIndex < assignments.size(); ++rightIndex) {
            const Assignment &right = assignments.at(rightIndex);
            if ((!left.changed && !right.changed) || !sequencesConflict(left.sequence, right.sequence)) {
                continue;
            }

            return {.error = QStringLiteral("%1 conflicts with %2 in the pending assignments.")
                                 .arg(left.action->friendlyName, right.action->friendlyName)};
        }
    }

    QSet<QString> reportedOwners;
    for (const Assignment &assignment : assignments) {
        if (!assignment.changed) {
            continue;
        }

        for (const KGlobalAccel::MatchType matchType : {
                 KGlobalAccel::Equal,
                 KGlobalAccel::Shadows,
                 KGlobalAccel::Shadowed,
             }) {
            const QList<KGlobalShortcutInfo> owners = KGlobalAccel::globalShortcutsByKey(assignment.sequence, matchType);
            for (const KGlobalShortcutInfo &owner : owners) {
                const QString ownerKey = actionKey(owner.componentUniqueName(), owner.uniqueName());
                if (ownerKey == actionKey(*assignment.action)) {
                    continue;
                }

                if (!finalOwnerStillConflicts(owner, assignment.sequence, actionsByKey)) {
                    continue;
                }

                const QString reportKey = ownerKey + QChar(0x1f) + assignment.sequence.toString(QKeySequence::PortableText);
                if (reportedOwners.contains(reportKey)) {
                    continue;
                }
                reportedOwners.insert(reportKey);

                return {.error = QStringLiteral("%1 for %2 conflicts with %3.")
                                     .arg(
                                         displaySequence(assignment.sequence),
                                         assignment.action->friendlyName,
                                         ownerDescription(owner))};
            }
        }
    }

    return {};
}

ShortcutBackend::OperationResult ShortcutBackend::apply(const QList<ShortcutAction> &actions) const
{
    QList<Mutation> mutations;
    for (const ShortcutAction &action : actions) {
        if (!sequenceListsEqual(action.baseline, action.edited)) {
            mutations.append({action, action.baseline, action.edited});
        }
    }

    if (mutations.isEmpty()) {
        return {};
    }

    const LoadResult current = loadActions();
    if (!current.succeeded()) {
        return {.error = current.error};
    }

    QHash<QString, QList<QKeySequence>> currentShortcuts;
    currentShortcuts.reserve(current.actions.size());
    for (const ShortcutAction &action : current.actions) {
        currentShortcuts.insert(actionKey(action), action.baseline);
    }

    for (const ShortcutAction &action : actions) {
        const auto iterator = currentShortcuts.constFind(actionKey(action));
        if (iterator == currentShortcuts.cend()) {
            return {.error = QStringLiteral("%1 is no longer active. Reload before applying changes.")
                                 .arg(action.friendlyName)};
        }
        if (!sequenceListsEqual(iterator.value(), action.baseline)) {
            return {.error = QStringLiteral("%1 changed outside this editor. Reload before applying changes.")
                                 .arg(action.friendlyName)};
        }
    }

    const OperationResult validation = validate(actions);
    if (!validation.succeeded()) {
        return validation;
    }

    for (const Mutation &mutation : mutations) {
        QString error;
        if (!setShortcutKeys(mutation.action.dbusId, {}, &error)) {
            const QString rollbackError = rollback(mutations);
            return {.error = rollbackError.isEmpty()
                    ? error
                    : QStringLiteral("%1 Rollback also failed: %2").arg(error, rollbackError)};
        }
    }

    for (const Mutation &mutation : mutations) {
        QString error;
        if (!setShortcutKeys(mutation.action.dbusId, mutation.after, &error)) {
            const QString rollbackError = rollback(mutations);
            return {.error = rollbackError.isEmpty()
                    ? error
                    : QStringLiteral("%1 Rollback also failed: %2").arg(error, rollbackError)};
        }

        const QList<QKeySequence> actual = shortcutKeys(mutation.action.dbusId, &error);
        if (!error.isEmpty() || !sequenceListsEqual(actual, mutation.after)) {
            const QString failure = error.isEmpty()
                ? QStringLiteral("KGlobalAccel did not retain the requested shortcuts for %1.")
                      .arg(mutation.action.friendlyName)
                : error;
            const QString rollbackError = rollback(mutations);
            return {.error = rollbackError.isEmpty()
                    ? failure
                    : QStringLiteral("%1 Rollback also failed: %2").arg(failure, rollbackError)};
        }
    }

    return {};
}

QList<QKeySequence> ShortcutBackend::shortcutKeys(const QStringList &actionId, QString *error) const
{
    QDBusInterface root(serviceName, rootPath, rootInterface, m_connection);
    const QDBusReply<QList<QKeySequence>> reply = root.call(QStringLiteral("shortcutKeys"), actionId);
    if (!reply.isValid()) {
        *error = dbusError(reply.error(), QStringLiteral("Reading shortcut assignments"));
        return {};
    }

    error->clear();
    return reply.value();
}

bool ShortcutBackend::setShortcutKeys(
    const QStringList &actionId,
    const QList<QKeySequence> &shortcuts,
    QString *error) const
{
    QDBusInterface root(serviceName, rootPath, rootInterface, m_connection);
    const QDBusMessage reply = root.call(
        QStringLiteral("setForeignShortcutKeys"),
        actionId,
        QVariant::fromValue(shortcuts));
    if (reply.type() == QDBusMessage::ErrorMessage) {
        *error = dbusError(QDBusError(reply), QStringLiteral("Writing shortcut assignments"));
        return false;
    }

    error->clear();
    return true;
}

QString ShortcutBackend::rollback(const QList<Mutation> &mutations) const
{
    QStringList errors;

    for (const Mutation &mutation : mutations) {
        QString error;
        if (!setShortcutKeys(mutation.action.dbusId, {}, &error)) {
            errors.append(error);
        }
    }

    for (const Mutation &mutation : mutations) {
        QString error;
        if (!setShortcutKeys(mutation.action.dbusId, mutation.before, &error)) {
            errors.append(error);
            continue;
        }

        const QList<QKeySequence> actual = shortcutKeys(mutation.action.dbusId, &error);
        if (!error.isEmpty()) {
            errors.append(error);
        } else if (!sequenceListsEqual(actual, mutation.before)) {
            errors.append(QStringLiteral("KGlobalAccel did not restore %1.").arg(mutation.action.friendlyName));
        }
    }

    errors.removeDuplicates();
    return errors.join(QLatin1Char(' '));
}
