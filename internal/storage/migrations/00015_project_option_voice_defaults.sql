-- +goose Up
-- Reproject active packages whose authored options inherit the service voice.
DELETE FROM import_metadata
WHERE key IN (
    SELECT 'workspace:' || item.course_id
    FROM course_items AS item
    JOIN active_courses AS active USING (course_id, version)
    CROSS JOIN json_each(item.payload_json, '$.options') AS option
    WHERE json_type(option.value, '$.tts') IN ('true', 'object')
      AND COALESCE(json_extract(option.value, '$.tts.voice'), '') = ''
);

-- +goose Down
SELECT 1;
