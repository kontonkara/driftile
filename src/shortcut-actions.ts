export interface ShortcutAction {
  readonly defaultSequence?: string;
  readonly name: string;
  readonly text: string;
}

const shortcutActionCatalog = [
  {
    name: "driftile_focus_column_left",
    text: "Driftile: Focus left",
    defaultSequence: "Meta+H",
  },
  {
    name: "driftile_focus_column_left_arrow",
    text: "Driftile: Focus left (arrow)",
    defaultSequence: "Meta+Left",
  },
  {
    name: "driftile_focus_column_right",
    text: "Driftile: Focus right",
    defaultSequence: "Meta+L",
  },
  {
    name: "driftile_focus_column_right_arrow",
    text: "Driftile: Focus right (arrow)",
    defaultSequence: "Meta+Right",
  },
  {
    name: "driftile_focus_column_or_output_left",
    text: "Driftile: Focus column or output left",
  },
  {
    name: "driftile_focus_column_or_output_right",
    text: "Driftile: Focus column or output right",
  },
  {
    name: "driftile_focus_column_right_or_first",
    text: "Driftile: Focus column right or first",
  },
  {
    name: "driftile_focus_column_left_or_last",
    text: "Driftile: Focus column left or last",
  },
  {
    name: "driftile_focus_column_first",
    text: "Driftile: Focus first column",
    defaultSequence: "Meta+Home",
  },
  {
    name: "driftile_focus_column_last",
    text: "Driftile: Focus last column",
    defaultSequence: "Meta+End",
  },
  {
    name: "driftile_focus_column_1",
    text: "Driftile: Focus column 1",
  },
  {
    name: "driftile_focus_column_2",
    text: "Driftile: Focus column 2",
  },
  {
    name: "driftile_focus_column_3",
    text: "Driftile: Focus column 3",
  },
  {
    name: "driftile_focus_column_4",
    text: "Driftile: Focus column 4",
  },
  {
    name: "driftile_focus_column_5",
    text: "Driftile: Focus column 5",
  },
  {
    name: "driftile_focus_column_6",
    text: "Driftile: Focus column 6",
  },
  {
    name: "driftile_focus_column_7",
    text: "Driftile: Focus column 7",
  },
  {
    name: "driftile_focus_column_8",
    text: "Driftile: Focus column 8",
  },
  {
    name: "driftile_focus_column_9",
    text: "Driftile: Focus column 9",
  },
  {
    name: "driftile_focus_window_up",
    text: "Driftile: Focus up",
    defaultSequence: "Meta+K",
  },
  {
    name: "driftile_focus_window_up_arrow",
    text: "Driftile: Focus up (arrow)",
    defaultSequence: "Meta+Up",
  },
  {
    name: "driftile_focus_window_down",
    text: "Driftile: Focus down",
    defaultSequence: "Meta+J",
  },
  {
    name: "driftile_focus_window_down_arrow",
    text: "Driftile: Focus down (arrow)",
    defaultSequence: "Meta+Down",
  },
  {
    name: "driftile_focus_window_up_or_previous_desktop",
    text: "Driftile: Focus up or previous desktop",
  },
  {
    name: "driftile_focus_window_down_or_next_desktop",
    text: "Driftile: Focus down or next desktop",
  },
  {
    name: "driftile_focus_window_up_or_output_up",
    text: "Driftile: Focus window or output up",
  },
  {
    name: "driftile_focus_window_down_or_output_down",
    text: "Driftile: Focus window or output down",
  },
  {
    name: "driftile_focus_window_down_or_column_left",
    text: "Driftile: Focus down or column left",
  },
  {
    name: "driftile_focus_window_down_or_column_right",
    text: "Driftile: Focus down or column right",
  },
  {
    name: "driftile_focus_window_up_or_column_left",
    text: "Driftile: Focus up or column left",
  },
  {
    name: "driftile_focus_window_up_or_column_right",
    text: "Driftile: Focus up or column right",
  },
  {
    name: "driftile_focus_window_top",
    text: "Driftile: Focus top window",
  },
  {
    name: "driftile_focus_window_bottom",
    text: "Driftile: Focus bottom window",
  },
  {
    name: "driftile_focus_window_down_or_top",
    text: "Driftile: Focus down or top",
  },
  {
    name: "driftile_focus_window_up_or_bottom",
    text: "Driftile: Focus up or bottom",
  },
  {
    name: "driftile_focus_window_in_column_1",
    text: "Driftile: Focus window 1 in column",
  },
  {
    name: "driftile_focus_window_in_column_2",
    text: "Driftile: Focus window 2 in column",
  },
  {
    name: "driftile_focus_window_in_column_3",
    text: "Driftile: Focus window 3 in column",
  },
  {
    name: "driftile_focus_window_in_column_4",
    text: "Driftile: Focus window 4 in column",
  },
  {
    name: "driftile_focus_window_in_column_5",
    text: "Driftile: Focus window 5 in column",
  },
  {
    name: "driftile_focus_window_in_column_6",
    text: "Driftile: Focus window 6 in column",
  },
  {
    name: "driftile_focus_window_in_column_7",
    text: "Driftile: Focus window 7 in column",
  },
  {
    name: "driftile_focus_window_in_column_8",
    text: "Driftile: Focus window 8 in column",
  },
  {
    name: "driftile_focus_window_in_column_9",
    text: "Driftile: Focus window 9 in column",
  },
  {
    name: "driftile_focus_window_previous",
    text: "Driftile: Focus previous window",
  },
  {
    name: "driftile_move_column_left",
    text: "Driftile: Move column left",
    defaultSequence: "Meta+Ctrl+H",
  },
  {
    name: "driftile_move_column_left_arrow",
    text: "Driftile: Move column left (arrow)",
    defaultSequence: "Meta+Ctrl+Left",
  },
  {
    name: "driftile_move_column_right",
    text: "Driftile: Move column right",
    defaultSequence: "Meta+Ctrl+L",
  },
  {
    name: "driftile_move_column_right_arrow",
    text: "Driftile: Move column right (arrow)",
    defaultSequence: "Meta+Ctrl+Right",
  },
  {
    name: "driftile_move_column_left_or_to_output_left",
    text: "Driftile: Move column left or to output left",
  },
  {
    name: "driftile_move_column_right_or_to_output_right",
    text: "Driftile: Move column right or to output right",
  },
  {
    name: "driftile_move_column_to_first",
    text: "Driftile: Move column to first",
    defaultSequence: "Meta+Ctrl+Home",
  },
  {
    name: "driftile_move_column_to_last",
    text: "Driftile: Move column to last",
    defaultSequence: "Meta+Ctrl+End",
  },
  {
    name: "driftile_move_column_to_index_1",
    text: "Driftile: Move column to position 1",
  },
  {
    name: "driftile_move_column_to_index_2",
    text: "Driftile: Move column to position 2",
  },
  {
    name: "driftile_move_column_to_index_3",
    text: "Driftile: Move column to position 3",
  },
  {
    name: "driftile_move_column_to_index_4",
    text: "Driftile: Move column to position 4",
  },
  {
    name: "driftile_move_column_to_index_5",
    text: "Driftile: Move column to position 5",
  },
  {
    name: "driftile_move_column_to_index_6",
    text: "Driftile: Move column to position 6",
  },
  {
    name: "driftile_move_column_to_index_7",
    text: "Driftile: Move column to position 7",
  },
  {
    name: "driftile_move_column_to_index_8",
    text: "Driftile: Move column to position 8",
  },
  {
    name: "driftile_move_column_to_index_9",
    text: "Driftile: Move column to position 9",
  },
  {
    name: "driftile_move_window_left",
    text: "Driftile: Consume or expel window left",
    defaultSequence: "Meta+[",
  },
  {
    name: "driftile_move_window_right",
    text: "Driftile: Consume or expel window right",
    defaultSequence: "Meta+]",
  },
  {
    name: "driftile_swap_window_left",
    text: "Driftile: Swap window left",
  },
  {
    name: "driftile_swap_window_right",
    text: "Driftile: Swap window right",
  },
  {
    name: "driftile_consume_window_into_column",
    text: "Driftile: Consume window into column",
    defaultSequence: "Meta+,",
  },
  {
    name: "driftile_expel_window_from_column",
    text: "Driftile: Expel window from column",
    defaultSequence: "Meta+.",
  },
  {
    name: "driftile_move_window_up",
    text: "Driftile: Move window up",
    defaultSequence: "Meta+Ctrl+K",
  },
  {
    name: "driftile_move_window_up_arrow",
    text: "Driftile: Move window up (arrow)",
    defaultSequence: "Meta+Ctrl+Up",
  },
  {
    name: "driftile_move_window_down",
    text: "Driftile: Move window down",
    defaultSequence: "Meta+Ctrl+J",
  },
  {
    name: "driftile_move_window_down_arrow",
    text: "Driftile: Move window down (arrow)",
    defaultSequence: "Meta+Ctrl+Down",
  },
  {
    name: "driftile_move_window_up_or_to_previous_desktop",
    text: "Driftile: Move window up or to previous desktop",
  },
  {
    name: "driftile_move_window_down_or_to_next_desktop",
    text: "Driftile: Move window down or to next desktop",
  },
  {
    name: "driftile_move_window_up_or_to_output_up",
    text: "Driftile: Move window up or to output up",
  },
  {
    name: "driftile_move_window_down_or_to_output_down",
    text: "Driftile: Move window down or to output down",
  },
  {
    name: "driftile_insert_window_into_stack_left",
    text: "Driftile: Insert window into stack left",
  },
  {
    name: "driftile_insert_window_into_stack_right",
    text: "Driftile: Insert window into stack right",
  },
  {
    name: "driftile_toggle_floating",
    text: "Driftile: Toggle floating",
    defaultSequence: "Meta+V",
  },
  {
    name: "driftile_switch_focus_between_floating_and_tiling",
    text: "Driftile: Switch focus between floating and tiling",
    defaultSequence: "Meta+Shift+V",
  },
  {
    name: "driftile_focus_floating",
    text: "Driftile: Focus floating",
  },
  {
    name: "driftile_focus_tiling",
    text: "Driftile: Focus tiling",
  },
  {
    name: "driftile_toggle_fullscreen",
    text: "Driftile: Toggle fullscreen",
    defaultSequence: "Meta+Shift+F",
  },
  {
    name: "driftile_maximize_window_to_edges",
    text: "Driftile: Maximize window to edges",
    defaultSequence: "Meta+M",
  },
  {
    name: "driftile_focus_previous_desktop",
    text: "Driftile: Focus previous desktop",
    defaultSequence: "Meta+I",
  },
  {
    name: "driftile_focus_previous_desktop_page_up",
    text: "Driftile: Focus previous desktop (Page Up)",
    defaultSequence: "Meta+PgUp",
  },
  {
    name: "driftile_focus_next_desktop",
    text: "Driftile: Focus next desktop",
    defaultSequence: "Meta+U",
  },
  {
    name: "driftile_focus_next_desktop_page_down",
    text: "Driftile: Focus next desktop (Page Down)",
    defaultSequence: "Meta+PgDown",
  },
  {
    name: "driftile_focus_last_used_desktop",
    text: "Driftile: Focus last-used desktop",
  },
  {
    name: "driftile_move_desktop_down",
    text: "Driftile: Move desktop down",
    defaultSequence: "Meta+Shift+U",
  },
  {
    name: "driftile_move_desktop_down_page_down",
    text: "Driftile: Move desktop down (Page Down)",
    defaultSequence: "Meta+Shift+PgDown",
  },
  {
    name: "driftile_move_desktop_up",
    text: "Driftile: Move desktop up",
    defaultSequence: "Meta+Shift+I",
  },
  {
    name: "driftile_move_desktop_up_page_up",
    text: "Driftile: Move desktop up (Page Up)",
    defaultSequence: "Meta+Shift+PgUp",
  },
  {
    name: "driftile_focus_desktop_1",
    text: "Driftile: Focus desktop 1",
    defaultSequence: "Meta+1",
  },
  {
    name: "driftile_focus_desktop_2",
    text: "Driftile: Focus desktop 2",
    defaultSequence: "Meta+2",
  },
  {
    name: "driftile_focus_desktop_3",
    text: "Driftile: Focus desktop 3",
    defaultSequence: "Meta+3",
  },
  {
    name: "driftile_focus_desktop_4",
    text: "Driftile: Focus desktop 4",
    defaultSequence: "Meta+4",
  },
  {
    name: "driftile_focus_desktop_5",
    text: "Driftile: Focus desktop 5",
    defaultSequence: "Meta+5",
  },
  {
    name: "driftile_focus_desktop_6",
    text: "Driftile: Focus desktop 6",
    defaultSequence: "Meta+6",
  },
  {
    name: "driftile_focus_desktop_7",
    text: "Driftile: Focus desktop 7",
    defaultSequence: "Meta+7",
  },
  {
    name: "driftile_focus_desktop_8",
    text: "Driftile: Focus desktop 8",
    defaultSequence: "Meta+8",
  },
  {
    name: "driftile_focus_desktop_9",
    text: "Driftile: Focus desktop 9",
    defaultSequence: "Meta+9",
  },
  {
    name: "driftile_move_column_to_previous_desktop",
    text: "Driftile: Move column to previous desktop",
    defaultSequence: "Meta+Ctrl+I",
  },
  {
    name: "driftile_move_column_to_previous_desktop_page_up",
    text: "Driftile: Move column to previous desktop (Page Up)",
    defaultSequence: "Meta+Ctrl+PgUp",
  },
  {
    name: "driftile_move_column_to_next_desktop",
    text: "Driftile: Move column to next desktop",
    defaultSequence: "Meta+Ctrl+U",
  },
  {
    name: "driftile_move_column_to_next_desktop_page_down",
    text: "Driftile: Move column to next desktop (Page Down)",
    defaultSequence: "Meta+Ctrl+PgDown",
  },
  {
    name: "driftile_move_column_to_desktop_1",
    text: "Driftile: Move column to desktop 1",
    defaultSequence: "Meta+Ctrl+1",
  },
  {
    name: "driftile_move_column_to_desktop_2",
    text: "Driftile: Move column to desktop 2",
    defaultSequence: "Meta+Ctrl+2",
  },
  {
    name: "driftile_move_column_to_desktop_3",
    text: "Driftile: Move column to desktop 3",
    defaultSequence: "Meta+Ctrl+3",
  },
  {
    name: "driftile_move_column_to_desktop_4",
    text: "Driftile: Move column to desktop 4",
    defaultSequence: "Meta+Ctrl+4",
  },
  {
    name: "driftile_move_column_to_desktop_5",
    text: "Driftile: Move column to desktop 5",
    defaultSequence: "Meta+Ctrl+5",
  },
  {
    name: "driftile_move_column_to_desktop_6",
    text: "Driftile: Move column to desktop 6",
    defaultSequence: "Meta+Ctrl+6",
  },
  {
    name: "driftile_move_column_to_desktop_7",
    text: "Driftile: Move column to desktop 7",
    defaultSequence: "Meta+Ctrl+7",
  },
  {
    name: "driftile_move_column_to_desktop_8",
    text: "Driftile: Move column to desktop 8",
    defaultSequence: "Meta+Ctrl+8",
  },
  {
    name: "driftile_move_column_to_desktop_9",
    text: "Driftile: Move column to desktop 9",
    defaultSequence: "Meta+Ctrl+9",
  },
  {
    name: "driftile_move_window_to_previous_desktop",
    text: "Driftile: Move window to previous desktop",
  },
  {
    name: "driftile_move_window_to_previous_desktop_page_up",
    text: "Driftile: Move window to previous desktop (Page Up)",
  },
  {
    name: "driftile_move_window_to_next_desktop",
    text: "Driftile: Move window to next desktop",
  },
  {
    name: "driftile_move_window_to_next_desktop_page_down",
    text: "Driftile: Move window to next desktop (Page Down)",
  },
  {
    name: "driftile_move_window_to_desktop_1",
    text: "Driftile: Move window to desktop 1",
  },
  {
    name: "driftile_move_window_to_desktop_2",
    text: "Driftile: Move window to desktop 2",
  },
  {
    name: "driftile_move_window_to_desktop_3",
    text: "Driftile: Move window to desktop 3",
  },
  {
    name: "driftile_move_window_to_desktop_4",
    text: "Driftile: Move window to desktop 4",
  },
  {
    name: "driftile_move_window_to_desktop_5",
    text: "Driftile: Move window to desktop 5",
  },
  {
    name: "driftile_move_window_to_desktop_6",
    text: "Driftile: Move window to desktop 6",
  },
  {
    name: "driftile_move_window_to_desktop_7",
    text: "Driftile: Move window to desktop 7",
  },
  {
    name: "driftile_move_window_to_desktop_8",
    text: "Driftile: Move window to desktop 8",
  },
  {
    name: "driftile_move_window_to_desktop_9",
    text: "Driftile: Move window to desktop 9",
  },
  {
    name: "driftile_focus_output_left",
    text: "Driftile: Focus output left",
    defaultSequence: "Meta+Shift+H",
  },
  {
    name: "driftile_focus_output_left_arrow",
    text: "Driftile: Focus output left (arrow)",
    defaultSequence: "Meta+Shift+Left",
  },
  {
    name: "driftile_focus_output_right",
    text: "Driftile: Focus output right",
    defaultSequence: "Meta+Shift+L",
  },
  {
    name: "driftile_focus_output_right_arrow",
    text: "Driftile: Focus output right (arrow)",
    defaultSequence: "Meta+Shift+Right",
  },
  {
    name: "driftile_focus_output_up",
    text: "Driftile: Focus output up",
    defaultSequence: "Meta+Shift+K",
  },
  {
    name: "driftile_focus_output_up_arrow",
    text: "Driftile: Focus output up (arrow)",
    defaultSequence: "Meta+Shift+Up",
  },
  {
    name: "driftile_focus_output_down",
    text: "Driftile: Focus output down",
    defaultSequence: "Meta+Shift+J",
  },
  {
    name: "driftile_focus_output_down_arrow",
    text: "Driftile: Focus output down (arrow)",
    defaultSequence: "Meta+Shift+Down",
  },
  {
    name: "driftile_focus_output_previous",
    text: "Driftile: Focus previous output",
  },
  {
    name: "driftile_focus_output_next",
    text: "Driftile: Focus next output",
  },
  {
    name: "driftile_move_column_to_output_left",
    text: "Driftile: Move column to output left",
    defaultSequence: "Meta+Ctrl+Shift+H",
  },
  {
    name: "driftile_move_column_to_output_left_arrow",
    text: "Driftile: Move column to output left (arrow)",
    defaultSequence: "Meta+Ctrl+Shift+Left",
  },
  {
    name: "driftile_move_column_to_output_right",
    text: "Driftile: Move column to output right",
    defaultSequence: "Meta+Ctrl+Shift+L",
  },
  {
    name: "driftile_move_column_to_output_right_arrow",
    text: "Driftile: Move column to output right (arrow)",
    defaultSequence: "Meta+Ctrl+Shift+Right",
  },
  {
    name: "driftile_move_column_to_output_up",
    text: "Driftile: Move column to output up",
    defaultSequence: "Meta+Ctrl+Shift+K",
  },
  {
    name: "driftile_move_column_to_output_up_arrow",
    text: "Driftile: Move column to output up (arrow)",
    defaultSequence: "Meta+Ctrl+Shift+Up",
  },
  {
    name: "driftile_move_column_to_output_down",
    text: "Driftile: Move column to output down",
    defaultSequence: "Meta+Ctrl+Shift+J",
  },
  {
    name: "driftile_move_column_to_output_down_arrow",
    text: "Driftile: Move column to output down (arrow)",
    defaultSequence: "Meta+Ctrl+Shift+Down",
  },
  {
    name: "driftile_move_column_to_output_previous",
    text: "Driftile: Move column to previous output",
  },
  {
    name: "driftile_move_column_to_output_next",
    text: "Driftile: Move column to next output",
  },
  {
    name: "driftile_move_window_to_output_left",
    text: "Driftile: Move window to output left",
  },
  {
    name: "driftile_move_window_to_output_left_arrow",
    text: "Driftile: Move window to output left (arrow)",
  },
  {
    name: "driftile_move_window_to_output_right",
    text: "Driftile: Move window to output right",
  },
  {
    name: "driftile_move_window_to_output_right_arrow",
    text: "Driftile: Move window to output right (arrow)",
  },
  {
    name: "driftile_move_window_to_output_up",
    text: "Driftile: Move window to output up",
  },
  {
    name: "driftile_move_window_to_output_up_arrow",
    text: "Driftile: Move window to output up (arrow)",
  },
  {
    name: "driftile_move_window_to_output_down",
    text: "Driftile: Move window to output down",
  },
  {
    name: "driftile_move_window_to_output_down_arrow",
    text: "Driftile: Move window to output down (arrow)",
  },
  {
    name: "driftile_move_window_to_output_previous",
    text: "Driftile: Move window to previous output",
  },
  {
    name: "driftile_move_window_to_output_next",
    text: "Driftile: Move window to next output",
  },
  {
    name: "driftile_switch_preset_column_width",
    text: "Driftile: Switch preset column width",
    defaultSequence: "Meta+R",
  },
  {
    name: "driftile_switch_preset_column_width_back",
    text: "Driftile: Switch preset column width back",
    defaultSequence: "Meta+Shift+R",
  },
  {
    name: "driftile_maximize_column",
    text: "Driftile: Maximize column",
    defaultSequence: "Meta+F",
  },
  {
    name: "driftile_toggle_column_tabbed_display",
    text: "Driftile: Toggle tabbed column",
    defaultSequence: "Meta+W",
  },
  {
    name: "driftile_set_column_stacked_display",
    text: "Driftile: Set stacked column display",
  },
  {
    name: "driftile_set_column_tabbed_display",
    text: "Driftile: Set tabbed column display",
  },
  {
    name: "driftile_expand_column_to_available_width",
    text: "Driftile: Expand column to available width",
    defaultSequence: "Meta+Ctrl+F",
  },
  {
    name: "driftile_center_column",
    text: "Driftile: Center column",
    defaultSequence: "Meta+C",
  },
  {
    name: "driftile_center_visible_columns",
    text: "Driftile: Center visible columns",
    defaultSequence: "Meta+Ctrl+C",
  },
  {
    name: "driftile_decrease_column_width",
    text: "Driftile: Decrease column width",
    defaultSequence: "Meta+-",
  },
  {
    name: "driftile_increase_column_width",
    text: "Driftile: Increase column width",
    defaultSequence: "Meta+=",
  },
  {
    name: "driftile_decrease_window_height",
    text: "Driftile: Decrease window height",
    defaultSequence: "Meta+_",
  },
  {
    name: "driftile_increase_window_height",
    text: "Driftile: Increase window height",
    defaultSequence: "Meta++",
  },
  {
    name: "driftile_switch_preset_window_height",
    text: "Driftile: Switch preset window height",
    defaultSequence: "Meta+Ctrl+Shift+R",
  },
  {
    name: "driftile_switch_preset_window_height_back",
    text: "Driftile: Switch preset window height back",
  },
  {
    name: "driftile_reset_window_height",
    text: "Driftile: Reset window height",
    defaultSequence: "Meta+Ctrl+R",
  },
  {
    name: "driftile_reset_column_width",
    text: "Driftile: Reset column width",
  },
  {
    name: "driftile_close_window",
    text: "Driftile: Close window",
    defaultSequence: "Meta+Q",
  },
] as const satisfies readonly ShortcutAction[];

export type ShortcutActionName = (typeof shortcutActionCatalog)[number]["name"];

export const shortcutActions: readonly ShortcutAction[] = shortcutActionCatalog;
