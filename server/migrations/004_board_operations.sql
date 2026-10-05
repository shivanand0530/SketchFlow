CREATE TABLE board_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  operation_id uuid NOT NULL,
  sequence bigint GENERATED ALWAYS AS IDENTITY,
  type text NOT NULL CHECK (type IN ('CREATE_OBJECT', 'UPDATE_OBJECT', 'DELETE_OBJECT')),
  action text NOT NULL CHECK (action IN ('normal', 'undo', 'redo')),
  payload jsonb NOT NULL,
  inverse_payload jsonb NOT NULL,
  target_operation_id uuid REFERENCES board_operations(id),
  undone boolean NOT NULL DEFAULT false,
  redo_invalidated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, operation_id),
  UNIQUE (board_id, sequence)
);

CREATE INDEX board_operations_history_idx ON board_operations(board_id, sequence DESC);
CREATE INDEX board_operations_user_idx ON board_operations(board_id, user_id, sequence DESC);
