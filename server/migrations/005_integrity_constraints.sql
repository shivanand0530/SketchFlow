ALTER TABLE board_objects
  ADD CONSTRAINT board_objects_id_format CHECK (id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  ADD CONSTRAINT board_objects_type_check CHECK (object_type IN ('circle', 'rectangle', 'point', 'polygon', 'polyline', 'pen', 'line', 'arrow', 'note'));

ALTER TABLE boards
  ADD CONSTRAINT boards_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 160);

ALTER TABLE users
  ADD CONSTRAINT users_email_length CHECK (char_length(email) BETWEEN 3 AND 254),
  ADD CONSTRAINT users_display_name_length CHECK (char_length(trim(display_name)) BETWEEN 1 AND 120);