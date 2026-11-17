package course

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"

	coursev1 "test-driven-study/contracts/course/v1"
)

type v1Schemas struct {
	manifest *jsonschema.Schema
	items    *jsonschema.Schema
}

var loadSchemas = sync.OnceValues(func() (v1Schemas, error) {
	compiler := jsonschema.NewCompiler()
	compiler.DefaultDraft(jsonschema.Draft2020)
	compiler.UseLoader(jsonschema.SchemeURLLoader{})
	var schemas v1Schemas
	for name, target := range map[string]**jsonschema.Schema{
		"manifest.schema.json": &schemas.manifest,
		"items.schema.json":    &schemas.items,
	} {
		data, err := coursev1.Files.ReadFile(name)
		if err != nil {
			return schemas, err
		}
		document, err := jsonschema.UnmarshalJSON(bytes.NewReader(data))
		if err != nil {
			return schemas, err
		}
		location := "https://study.example/contracts/course/v1/" + name
		if err := compiler.AddResource(location, document); err != nil {
			return schemas, err
		}
		*target, err = compiler.Compile(location)
		if err != nil {
			return schemas, err
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
