// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#include "shortcuttablemodel.h"

#include <QCoreApplication>
#include <QVariant>

#include <algorithm>
#include <utility>

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
        default:
            return {};
        }
    }

    if (role == Qt::ToolTipRole) {
        if (index.column() == ActionColumn) {
            return action.uniqueName;
        }
        if (action.edited.size() > 2) {
            return QCoreApplication::translate(
                       "ShortcutTableModel",
                       "Additional assignments are preserved: %1")
                .arg(displaySequences(action.edited.mid(2)));
        }
    }

    if (role == SearchRole) {
        if (index.column() == ActionColumn) {
            return action.friendlyName + QLatin1Char(' ') + action.uniqueName;
        }
        return index.column() == PrimaryColumn ? displaySequence(primary) : displaySequence(alternate);
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
    Q_EMIT dataChanged(index(row, PrimaryColumn), index(row, AlternateColumn));
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
    Q_EMIT dataChanged(index(0, PrimaryColumn), index(m_actions.size() - 1, AlternateColumn));
    emitDirtyIfChanged(wasDirty);
}

void ShortcutTableModel::markApplied()
{
    const bool wasDirty = isDirty();
    for (ShortcutAction &action : m_actions) {
        action.baseline = action.edited;
    }
    emitDirtyIfChanged(wasDirty);
}

bool ShortcutTableModel::isDirty() const
{
    return std::any_of(m_actions.cbegin(), m_actions.cend(), [](const ShortcutAction &action) {
        return !sequenceListsEqual(action.baseline, action.edited);
    });
}

void ShortcutTableModel::emitDirtyIfChanged(bool wasDirty)
{
    const bool dirty = isDirty();
    if (wasDirty != dirty) {
        Q_EMIT dirtyChanged(dirty);
    }
}
