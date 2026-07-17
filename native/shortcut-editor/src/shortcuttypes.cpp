// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#include "shortcuttypes.h"

#include <QCoreApplication>

QString actionKey(const ShortcutAction &action)
{
    return actionKey(action.dbusId.value(0), action.uniqueName);
}

QString actionKey(const QString &componentUniqueName, const QString &actionUniqueName)
{
    return componentUniqueName + QChar(0x1f) + actionUniqueName;
}

QString displaySequence(const QKeySequence &sequence)
{
    if (sequence.isEmpty()) {
        return QCoreApplication::translate("ShortcutTypes", "Unassigned");
    }

    return sequence.toString(QKeySequence::NativeText);
}

QString displaySequences(const QList<QKeySequence> &sequences)
{
    if (sequences.isEmpty()) {
        return displaySequence(QKeySequence());
    }

    QStringList display;
    display.reserve(sequences.size());

    for (const QKeySequence &sequence : sequences) {
        display.append(displaySequence(sequence));
    }

    return display.join(QStringLiteral(", "));
}

bool sequencesConflict(const QKeySequence &left, const QKeySequence &right)
{
    if (left.isEmpty() || right.isEmpty()) {
        return false;
    }

    return left.matches(right) != QKeySequence::NoMatch || right.matches(left) != QKeySequence::NoMatch;
}

bool sequenceListsEqual(const QList<QKeySequence> &left, const QList<QKeySequence> &right)
{
    return left == right;
}

QList<QKeySequence> normalizedSequences(const QList<QKeySequence> &sequences)
{
    QList<QKeySequence> result;
    result.reserve(sequences.size());

    for (const QKeySequence &sequence : sequences) {
        if (!sequence.isEmpty() && !result.contains(sequence)) {
            result.append(sequence);
        }
    }

    return result;
}

QList<QKeySequence> editedPairWithPreservedTail(
    const QList<QKeySequence> &current,
    const QKeySequence &primary,
    const QKeySequence &alternate)
{
    QList<QKeySequence> result;
    result.reserve(qMax(current.size(), 2));

    if (!primary.isEmpty()) {
        result.append(primary);
    }

    if (!alternate.isEmpty() && !result.contains(alternate)) {
        result.append(alternate);
    }

    for (qsizetype index = 2; index < current.size(); ++index) {
        const QKeySequence &sequence = current.at(index);
        if (!sequence.isEmpty() && !result.contains(sequence)) {
            result.append(sequence);
        }
    }

    return result;
}
