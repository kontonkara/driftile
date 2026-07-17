// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#include "shortcuttablemodel.h"

#include <QCoreApplication>
#include <QFont>
#include <QVariant>

#include <algorithm>
#include <utility>

namespace
{
QString displayShortcutList(const QList<QKeySequence> &sequences)
{
    return sequences.isEmpty() ? displaySequence({}) : displaySequences(sequences);
}

const QList<int> &changedDataRoles()
{
    static const QList<int> roles = {
        Qt::DisplayRole,
        Qt::ToolTipRole,
        Qt::FontRole,
        ShortcutTableModel::SearchRole,
    };
    return roles;
}
}

ShortcutTableModel::ShortcutTableModel(QObject *parent)
    : QAbstractTableModel(parent)
{
}

int ShortcutTableModel::rowCount(const QModelIndex &parent) const
{
    return parent.isValid() ? 0 : m_actions.size();
}

int ShortcutTableModel::columnCount(const QModelIndex &parent) const
{
    return parent.isValid() ? 0 : ColumnCount;
}

QVariant ShortcutTableModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_actions.size()) {
        return {};
    }

    const ShortcutAction &action = m_actions.at(index.row());
    const QKeySequence primary = action.edited.value(0);
    const QKeySequence alternate = action.edited.value(1);

    if (role == Qt::DisplayRole) {
        switch (index.column()) {
        case ActionColumn:
            return action.friendlyName;
        case PrimaryColumn:
            return displaySequence(primary);
        case AlternateColumn:
            return displaySequence(alternate);
        case DefaultColumn:
            return displayShortcutList(action.defaults);
        default:
            return {};
        }
    }

    if (role == Qt::ToolTipRole) {
        const QString defaults = displayShortcutList(action.defaults);
        QStringList details;
        if (index.column() == ActionColumn) {
            details.append(action.uniqueName);
        }
        if ((index.column() == PrimaryColumn || index.column() == AlternateColumn) && action.edited.size() > 2) {
            details.append(
                QCoreApplication::translate(
                    "ShortcutTableModel",
                    "Additional assignments are preserved: %1")
                    .arg(displaySequences(action.edited.mid(2))));
        }
        details.append(
            QCoreApplication::translate("ShortcutTableModel", "Registered defaults: %1").arg(defaults));
        return details.join(QLatin1Char('\n'));
    }

    if (role == SearchRole) {
        if (index.column() == ActionColumn) {
            return action.friendlyName + QLatin1Char(' ') + action.uniqueName;
        }
        switch (index.column()) {
        case PrimaryColumn:
            return displaySequence(primary);
        case AlternateColumn:
            return displaySequence(alternate);
        case DefaultColumn:
            return displayShortcutList(action.defaults);
        default:
            return {};
        }
    }

    if (role == Qt::FontRole && !sequenceListsEqual(action.baseline, action.edited)) {
        QFont font;
        font.setBold(true);
        return font;
    }

    return {};
}

QVariant ShortcutTableModel::headerData(int section, Qt::Orientation orientation, int role) const
{
    if (orientation != Qt::Horizontal || role != Qt::DisplayRole) {
        return QAbstractTableModel::headerData(section, orientation, role);
    }

    switch (section) {
    case ActionColumn:
        return tr("Action");
    case PrimaryColumn:
        return tr("Primary shortcut");
    case AlternateColumn:
        return tr("Alternate shortcut");
    case DefaultColumn:
        return tr("Default shortcut");
    default:
        return {};
    }
}

Qt::ItemFlags ShortcutTableModel::flags(const QModelIndex &index) const
{
    return index.isValid() ? Qt::ItemIsEnabled | Qt::ItemIsSelectable : Qt::NoItemFlags;
}

void ShortcutTableModel::setActions(QList<ShortcutAction> actions)
{
    const bool wasDirty = isDirty();
    beginResetModel();
    m_actions = std::move(actions);
    endResetModel();
    emitDirtyIfChanged(wasDirty);
}

const QList<ShortcutAction> &ShortcutTableModel::actions() const
{
    return m_actions;
}

const ShortcutAction *ShortcutTableModel::actionAt(int row) const
{
    if (row < 0 || row >= m_actions.size()) {
        return nullptr;
    }

    return &m_actions.at(row);
}

void ShortcutTableModel::setEditedShortcuts(int row, QList<QKeySequence> shortcuts)
{
    if (row < 0 || row >= m_actions.size() || sequenceListsEqual(m_actions.at(row).edited, shortcuts)) {
        return;
    }

    const bool wasDirty = isDirty();
    m_actions[row].edited = std::move(shortcuts);
    Q_EMIT dataChanged(index(row, ActionColumn), index(row, DefaultColumn), changedDataRoles());
    emitDirtyIfChanged(wasDirty);
}

void ShortcutTableModel::restoreDefault(int row)
{
    if (row < 0 || row >= m_actions.size()) {
        return;
    }

    setEditedShortcuts(row, m_actions.at(row).defaults);
}

void ShortcutTableModel::restoreAllDefaults()
{
    const bool wasDirty = isDirty();
    bool changed = false;

    for (ShortcutAction &action : m_actions) {
        if (sequenceListsEqual(action.edited, action.defaults)) {
            continue;
        }
        action.edited = action.defaults;
        changed = true;
    }

    if (!changed) {
        return;
    }

    Q_EMIT dataChanged(
        index(0, ActionColumn),
        index(m_actions.size() - 1, DefaultColumn),
        changedDataRoles());
    emitDirtyIfChanged(wasDirty);
}

void ShortcutTableModel::resetEdits()
{
    const bool wasDirty = isDirty();
    if (!wasDirty) {
        return;
    }

    for (ShortcutAction &action : m_actions) {
        action.edited = action.baseline;
    }
    Q_EMIT dataChanged(
        index(0, ActionColumn),
        index(m_actions.size() - 1, DefaultColumn),
        changedDataRoles());
    emitDirtyIfChanged(wasDirty);
}

void ShortcutTableModel::markApplied()
{
    const bool wasDirty = isDirty();
    for (ShortcutAction &action : m_actions) {
        action.baseline = action.edited;
    }
    if (wasDirty) {
        Q_EMIT dataChanged(index(0, ActionColumn), index(m_actions.size() - 1, DefaultColumn), {Qt::FontRole});
    }
    emitDirtyIfChanged(wasDirty);
}

bool ShortcutTableModel::isDefault(int row) const
{
    return row >= 0 && row < m_actions.size()
        && sequenceListsEqual(m_actions.at(row).edited, m_actions.at(row).defaults);
}

int ShortcutTableModel::dirtyActionCount() const
{
    return static_cast<int>(std::count_if(
        m_actions.cbegin(),
        m_actions.cend(),
        [](const ShortcutAction &action) {
            return !sequenceListsEqual(action.baseline, action.edited);
        }));
}

bool ShortcutTableModel::isDirty() const
{
    return dirtyActionCount() != 0;
}

void ShortcutTableModel::emitDirtyIfChanged(bool wasDirty)
{
    const bool dirty = isDirty();
    if (wasDirty != dirty) {
        Q_EMIT dirtyChanged(dirty);
    }
}
