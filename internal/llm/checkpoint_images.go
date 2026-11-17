package llm

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strings"
)

func rewriteImageReferences(history []json.RawMessage, original json.RawMessage,
	encode bool) ([]json.RawMessage, error) {
	references := map[string]string{}
	var source any
	if decodeCheckpointValue(original, &source) != nil {
		return nil, checkpointFailure()
	}
	_, err := visitCheckpointImages(source, func(url string) (string, error) {
		placeholder := fmt.Sprintf("study-image://%x", sha256.Sum256([]byte(url)))
		if encode {
			references[url] = placeholder
		} else {
			references[placeholder] = url
		}
		return url, nil
	})
	if err != nil {
		return nil, err
	}
	result := make([]json.RawMessage, 0, len(history))
	for _, raw := range history {
		var item any
		if decodeCheckpointValue(raw, &item) != nil {
			return nil, checkpointFailure()
		}
		item, err = visitCheckpointImages(item, func(url string) (string, error) {
			mapped, ok := references[url]
			if !ok {
				return "", checkpointFailure()
			}
			if encode && !strings.HasPrefix(url, "data:") {
				return "", checkpointFailure()
			}
			return mapped, nil
		})
		if err != nil {
			return nil, err
		}
		data, err := json.Marshal(item)
		if err != nil {
			return nil, checkpointFailure()
		}
		result = append(result, data)
	}
	return result, nil
}

func decodeCheckpointValue(data []byte, target *any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	return decoder.Decode(target)
}

func visitCheckpointImages(value any, replace func(string) (string, error)) (any, error) {
	switch node := value.(type) {
	case map[string]any:
		if node["type"] == "input_image" {
			url, ok := node["image_url"].(string)
			if !ok {
				return nil, checkpointFailure()
			}
			next, err := replace(url)
			if err != nil {
				return nil, err
			}
			node["image_url"] = next
			return node, nil
		}
		for key, child := range node {
			next, err := visitCheckpointImages(child, replace)
			if err != nil {
				return nil, err
			}
			node[key] = next
		}
	case []any:
		for i, child := range node {
			next, err := visitCheckpointImages(child, replace)
			if err != nil {
				return nil, err
			}
			node[i] = next
		}
	}
	return value, nil
}
