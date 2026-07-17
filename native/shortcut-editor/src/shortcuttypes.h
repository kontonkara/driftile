// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#pragma once

#include <QKeySequence>
#include <QList>
#include <QString>
#include <QStringList>

struct ShortcutAction
{
    QStringList dbusId;
    QString uniqueName;
    QString friendlyName;
    QList<QKeySequence> baseline;
    QList<QKeySequence> edited;
};

[[nodiscard]] QString actionKey(const ShortcutAction &action);
[[nodiscard]] QString actionKey(const QString &componentUniqueName, const QString &actionUniqueName);
[[nodiscard]] QString displaySequence(const QKeySequence &sequence);
[[nodiscard]] QString displaySequences(const QList<QKeySequence> &sequences);
[[nodiscard]] bool sequencesConflict(const QKeySequence &left, const QKeySequence &right);
[[nodiscard]] bool sequenceListsEqual(const QList<QKeySequence> &left, const QList<QKeySequence> &right);
[[nodiscard]] QList<QKeySequence> editedPairWithPreservedTail(
    const QList<QKeySequence> &current,
    const QKeySequence &primary,
    const QKeySequence &alternate);
