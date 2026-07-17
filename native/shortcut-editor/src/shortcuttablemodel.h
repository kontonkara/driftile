// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#pragma once

#include "shortcuttypes.h"

#include <QAbstractTableModel>
#include <QList>

class ShortcutTableModel : public QAbstractTableModel
{
    Q_OBJECT

public:
    enum Column {
        ActionColumn,
        PrimaryColumn,
        AlternateColumn,
        DefaultColumn,
        ColumnCount,
    };

    enum Role {
        SearchRole = Qt::UserRole + 1,
    };

    explicit ShortcutTableModel(QObject *parent = nullptr);

    [[nodiscard]] int rowCount(const QModelIndex &parent = {}) const override;
    [[nodiscard]] int columnCount(const QModelIndex &parent = {}) const override;
    [[nodiscard]] QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    [[nodiscard]] QVariant headerData(int section, Qt::Orientation orientation, int role) const override;
    [[nodiscard]] Qt::ItemFlags flags(const QModelIndex &index) const override;

    void setActions(QList<ShortcutAction> actions);
    [[nodiscard]] const QList<ShortcutAction> &actions() const;
    [[nodiscard]] const ShortcutAction *actionAt(int row) const;
    void setEditedShortcuts(int row, QList<QKeySequence> shortcuts);
    void restoreDefault(int row);
    void restoreAllDefaults();
    void resetEdits();
    void markApplied();
    [[nodiscard]] bool isDefault(int row) const;
    [[nodiscard]] int dirtyActionCount() const;
    [[nodiscard]] bool isDirty() const;

Q_SIGNALS:
    void dirtyChanged(bool dirty);

private:
    void emitDirtyIfChanged(bool wasDirty);

    QList<ShortcutAction> m_actions;
};
