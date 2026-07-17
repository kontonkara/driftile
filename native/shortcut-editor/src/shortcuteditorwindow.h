// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#pragma once

#include "shortcutbackend.h"
#include "shortcuttablemodel.h"

#include <QWidget>

class QCloseEvent;
class QDialogButtonBox;
class QLabel;
class QLineEdit;
class QPushButton;
class QSortFilterProxyModel;
class QTableView;

class ShortcutEditorWindow : public QWidget
{
    Q_OBJECT

public:
    explicit ShortcutEditorWindow(QWidget *parent = nullptr);

protected:
    void closeEvent(QCloseEvent *event) override;

private Q_SLOTS:
    void editCurrentAction();
    void applyChanges();
    void resetChanges();
    void reloadActions();

private:
    [[nodiscard]] bool confirmDiscard();
    void updateButtons();
    void showError(const QString &message);
    void showStatus(const QString &message);

    ShortcutBackend m_backend;
    ShortcutTableModel *m_model;
    QSortFilterProxyModel *m_proxy;
    QLineEdit *m_search;
    QTableView *m_table;
    QLabel *m_status;
    QPushButton *m_editButton;
    QPushButton *m_reloadButton;
    QDialogButtonBox *m_buttons;
    QString m_componentUniqueName;
};
