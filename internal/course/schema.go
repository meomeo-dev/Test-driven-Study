package course

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"

	coursev1 "test-driven-study/contracts/course/v1"
	coursev2 "test-driven-study/contracts/course/v2"
)

type packageSchemas struct {
	manifest *jsonschema.Schema
	items    *jsonschema.Schema
}

var loadSchemas = sync.OnceValues(func() ([3]packageSchemas, error) {
	compiler := jsonschema.NewCompiler()
	compiler.DefaultDraft(jsonschema.Draft2020)
	compiler.UseLoader(jsonschema.SchemeURLLoader{})
	var schemas [3]packageSchemas
	for version, files := range []embed.FS{coursev1.Files, coursev2.Files} {
		version++
		for name, target := range map[string]**jsonschema.Schema{
			"manifest.schema.json": &schemas[version].manifest,
			"items.schema.json":    &schemas[version].items,
		} {
			data, err := files.ReadFile(name)
			if err != nil {
				return schemas, err
			}
			document, err := jsonschema.UnmarshalJSON(bytes.NewReader(data))
			if err != nil {
				return schemas, err
			}
			location := fmt.Sprintf("https://study.example/contracts/course/v%d/%s", version, name)
			if err := compiler.AddResource(location, document); err != nil {
				return schemas, err
			}
			*target, err = compiler.Compile(location)
			if err != nil {
				return schemas, err
			}
		}
	}
	return schemas, nil
})

func decodeFile[T any](data []byte, path string, schema *jsonschema.Schema) (T, error) {
	var value T
	document, err := jsonschema.UnmarshalJSON(bytes.NewReader(data))
	if err == nil {
		err = schema.Validate(document)
	}
	if err == nil {
		err = json.Unmarshal(data, &value)
	}
	if err != nil {
		return value, fmt.Errorf("%s: %w", path, err)
	}
	return value, nil
}
