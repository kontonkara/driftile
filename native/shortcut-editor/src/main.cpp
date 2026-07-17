// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#include "shortcuteditorwindow.h"

#include <QApplication>
#include <QCommandLineParser>
#include <QCoreApplication>
#include <QIcon>

namespace
{
constexpr auto desktopFileName = "io.github.kontonkara.driftile.shortcuts";
constexpr auto applicationIconName = "preferences-desktop-keyboard-shortcuts";
}

int main(int argc, char **argv)
{
    QApplication application(argc, argv);
    QCoreApplication::setApplicationName(QStringLiteral("driftile-shortcut-editor"));
    QCoreApplication::setApplicationVersion(QString::fromUtf8(DRIFTILE_VERSION));
    QCoreApplication::setOrganizationDomain(QStringLiteral("io.github.kontonkara"));
    QApplication::setApplicationDisplayName(QStringLiteral("Driftile Shortcuts"));
    QApplication::setDesktopFileName(QLatin1String(desktopFileName));
    QApplication::setWindowIcon(QIcon::fromTheme(QLatin1String(applicationIconName)));

    QCommandLineParser parser;
    parser.setApplicationDescription(QStringLiteral("Configure global shortcuts for Driftile."));
    parser.addHelpOption();
    parser.addVersionOption();
    parser.process(application);

    ShortcutEditorWindow window;
    window.show();

    return application.exec();
}
