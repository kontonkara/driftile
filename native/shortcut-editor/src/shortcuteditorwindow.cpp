// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#include "shortcuteditorwindow.h"

#include <KKeySequenceWidget>

#include <QAbstractItemView>
#include <QCloseEvent>
#include <QDialog>
#include <QDialogButtonBox>
#include <QFormLayout>
#include <QFont>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QItemSelectionModel>
#include <QLabel>
#include <QLineEdit>
#include <QMessageBox>
#include <QPushButton>
#include <QSortFilterProxyModel>
#include <QTableView>
#include <QVBoxLayout>

namespace
{
class ShortcutEditDialog : public QDialog
{
public:
    ShortcutEditDialog(const ShortcutAction &action, const QString &componentUniqueName, QWidget *parent)
        : QDialog(parent)
        , m_primary(new KKeySequenceWidget(this))
        , m_alternate(new KKeySequenceWidget(this))
    {
        setWindowTitle(tr("Edit %1").arg(action.friendlyName));

        for (KKeySequenceWidget *widget : {m_primary, m_alternate}) {
            widget->setCheckForConflictsAgainst(KKeySequenceWidget::None);
            widget->setComponentName(componentUniqueName);
            widget->setMultiKeyShortcutsAllowed(true);
        }

        m_primary->setKeySequence(action.edited.value(0));
        m_alternate->setKeySequence(action.edited.value(1));

        auto *description = new QLabel(
            tr("Conflicts are checked against the complete pending assignment when Apply is pressed."),
            this);
        description->setWordWrap(true);

        auto *form = new QFormLayout;
        form->addRow(tr("Primary:"), m_primary);
        form->addRow(tr("Alternate:"), m_alternate);

        auto *buttons = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
        connect(buttons, &QDialogButtonBox::accepted, this, &QDialog::accept);
        connect(buttons, &QDialogButtonBox::rejected, this, &QDialog::reject);

        auto *layout = new QVBoxLayout(this);
        layout->addWidget(description);
        layout->addLayout(form);
        layout->addWidget(buttons);
    }

    [[nodiscard]] QKeySequence primary() const
    {
        return m_primary->keySequence();
    }

    [[nodiscard]] QKeySequence alternate() const
    {
        return m_alternate->keySequence();
    }

private:
    KKeySequenceWidget *m_primary;
    KKeySequenceWidget *m_alternate;
};
}

ShortcutEditorWindow::ShortcutEditorWindow(QWidget *parent)
    : QWidget(parent)
    , m_model(new ShortcutTableModel(this))
    , m_proxy(new QSortFilterProxyModel(this))
    , m_search(new QLineEdit(this))
    , m_table(new QTableView(this))
    , m_status(new QLabel(this))
    , m_editButton(new QPushButton(tr("Edit…"), this))
    , m_reloadButton(new QPushButton(tr("Reload"), this))
    , m_buttons(new QDialogButtonBox(QDialogButtonBox::Apply | QDialogButtonBox::Reset | QDialogButtonBox::Close, this))
{
    setWindowTitle(tr("Driftile Shortcuts"));
    resize(860, 620);

    auto *heading = new QLabel(tr("Driftile shortcuts"), this);
    QFont headingFont = heading->font();
    headingFont.setBold(true);
    headingFont.setPointSizeF(headingFont.pointSizeF() * 1.25);
    heading->setFont(headingFont);

    auto *description = new QLabel(
        tr("Edit the current primary and alternate assignments. Nothing is written until Apply is pressed."),
        this);
    description->setWordWrap(true);

    m_search->setPlaceholderText(tr("Search actions or shortcuts…"));
    m_search->setClearButtonEnabled(true);

    m_proxy->setSourceModel(m_model);
    m_proxy->setFilterCaseSensitivity(Qt::CaseInsensitive);
    m_proxy->setFilterKeyColumn(-1);
    m_proxy->setFilterRole(ShortcutTableModel::SearchRole);
    m_proxy->setSortCaseSensitivity(Qt::CaseInsensitive);

    m_table->setModel(m_proxy);
    m_table->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_table->setSelectionMode(QAbstractItemView::SingleSelection);
    m_table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_table->setSortingEnabled(true);
    m_table->sortByColumn(ShortcutTableModel::ActionColumn, Qt::AscendingOrder);
    m_table->horizontalHeader()->setSectionResizeMode(ShortcutTableModel::ActionColumn, QHeaderView::Stretch);
    m_table->horizontalHeader()->setSectionResizeMode(ShortcutTableModel::PrimaryColumn, QHeaderView::ResizeToContents);
    m_table->horizontalHeader()->setSectionResizeMode(ShortcutTableModel::AlternateColumn, QHeaderView::ResizeToContents);
    m_table->verticalHeader()->setVisible(false);

    auto *tableButtons = new QHBoxLayout;
    tableButtons->addWidget(m_editButton);
    tableButtons->addWidget(m_reloadButton);
    tableButtons->addStretch();

    m_status->setWordWrap(true);

    auto *layout = new QVBoxLayout(this);
    layout->addWidget(heading);
    layout->addWidget(description);
    layout->addWidget(m_search);
    layout->addWidget(m_table, 1);
    layout->addLayout(tableButtons);
    layout->addWidget(m_status);
    layout->addWidget(m_buttons);

    connect(m_search, &QLineEdit::textChanged, m_proxy, &QSortFilterProxyModel::setFilterFixedString);
    connect(m_editButton, &QPushButton::clicked, this, &ShortcutEditorWindow::editCurrentAction);
    connect(m_reloadButton, &QPushButton::clicked, this, &ShortcutEditorWindow::reloadActions);
    connect(m_table, &QTableView::doubleClicked, this, &ShortcutEditorWindow::editCurrentAction);
    connect(m_table->selectionModel(), &QItemSelectionModel::selectionChanged, this, &ShortcutEditorWindow::updateButtons);
    connect(m_model, &ShortcutTableModel::dirtyChanged, this, &ShortcutEditorWindow::updateButtons);
    connect(m_buttons->button(QDialogButtonBox::Apply), &QPushButton::clicked, this, &ShortcutEditorWindow::applyChanges);
    connect(m_buttons->button(QDialogButtonBox::Reset), &QPushButton::clicked, this, &ShortcutEditorWindow::resetChanges);
    connect(m_buttons->button(QDialogButtonBox::Close), &QPushButton::clicked, this, &QWidget::close);

    reloadActions();
}

void ShortcutEditorWindow::closeEvent(QCloseEvent *event)
{
    if (confirmDiscard()) {
        event->accept();
    } else {
        event->ignore();
    }
}

void ShortcutEditorWindow::editCurrentAction()
{
    const QModelIndex proxyIndex = m_table->currentIndex();
    if (!proxyIndex.isValid()) {
        return;
    }

    const QModelIndex sourceIndex = m_proxy->mapToSource(proxyIndex);
    const ShortcutAction *action = m_model->actionAt(sourceIndex.row());
    if (action == nullptr) {
        return;
    }

    ShortcutEditDialog dialog(*action, m_componentUniqueName, this);
    if (dialog.exec() != QDialog::Accepted) {
        return;
    }

    m_model->setEditedShortcuts(
        sourceIndex.row(),
        editedPairWithPreservedTail(action->edited, dialog.primary(), dialog.alternate()));
    showStatus(tr("Changes are pending. Press Apply to write them."));
}

void ShortcutEditorWindow::applyChanges()
{
    const ShortcutBackend::OperationResult result = m_backend.apply(m_model->actions());
    if (!result.succeeded()) {
        showError(result.error);
        return;
    }

    m_model->markApplied();
    showStatus(tr("Shortcut assignments were applied."));
}

void ShortcutEditorWindow::resetChanges()
{
    m_model->resetEdits();
    showStatus(tr("Unapplied changes were reset."));
}

void ShortcutEditorWindow::reloadActions()
{
    if (!confirmDiscard()) {
        return;
    }

    const ShortcutBackend::LoadResult result = m_backend.loadActions();
    if (!result.succeeded()) {
        m_model->setActions({});
        m_componentUniqueName.clear();
        showError(result.error);
        updateButtons();
        return;
    }

    m_componentUniqueName = result.componentUniqueName;
    m_model->setActions(result.actions);
    if (!m_model->actions().isEmpty()) {
        m_table->selectRow(0);
    }
    showStatus(tr("Loaded %1 active actions from KGlobalAccel.").arg(m_model->rowCount()));
    updateButtons();
}

bool ShortcutEditorWindow::confirmDiscard()
{
    if (!m_model->isDirty()) {
        return true;
    }

    return QMessageBox::question(
               this,
               tr("Discard changes?"),
               tr("Discard all unapplied shortcut changes?"),
               QMessageBox::Discard | QMessageBox::Cancel,
               QMessageBox::Cancel)
        == QMessageBox::Discard;
}

void ShortcutEditorWindow::updateButtons()
{
    m_editButton->setEnabled(m_table->currentIndex().isValid());
    m_buttons->button(QDialogButtonBox::Apply)->setEnabled(m_model->isDirty());
    m_buttons->button(QDialogButtonBox::Reset)->setEnabled(m_model->isDirty());
}

void ShortcutEditorWindow::showError(const QString &message)
{
    m_status->setText(message);
    QMessageBox::critical(this, tr("Shortcut editor"), message);
}

void ShortcutEditorWindow::showStatus(const QString &message)
{
    m_status->setText(message);
}
