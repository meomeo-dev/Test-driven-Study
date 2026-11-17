package llm

const DefaultContextBudgetK = 274
const DefaultCompactThresholdK = 210
const DefaultCompactReserveK = 64
const DefaultOutputTokensK = 64

func normalizePolicy(p Parameters) (Parameters, error) {
	if p.CompactReserveK == 0 {
		p.CompactReserveK = DefaultCompactReserveK
	}
	if p.MaxOutputTokensK == 0 {
		p.MaxOutputTokensK = min(128, p.CompactReserveK)
	}
	if p.ContextBudgetK == 0 && p.CompactThresholdK == 0 {
		p.ContextBudgetK = DefaultContextBudgetK
		p.CompactThresholdK = DefaultCompactThresholdK
	} else if p.ContextBudgetK == 0 {
		p.ContextBudgetK = p.CompactThresholdK + p.CompactReserveK
	} else if p.CompactThresholdK == 0 {
		p.CompactThresholdK = p.ContextBudgetK - p.CompactReserveK
	}
	if p.WebSearch == "" {
		p.WebSearch = "required"
	}
	if p.MaxOutputTokensK < 1 || p.MaxOutputTokensK > 128 || p.CompactReserveK < p.MaxOutputTokensK ||
		p.CompactThresholdK < 16 || p.ContextBudgetK > 2048 || p.CompactReserveK > 256 ||
		p.ContextBudgetK != p.CompactThresholdK+p.CompactReserveK ||
		(p.WebSearch != "required" && p.WebSearch != "off") {
		return Parameters{}, ErrInvalid
	}
	return p, nil
}
func compactThreshold(p Parameters, searching bool) int {
	threshold := p.CompactThresholdK * 1024
	// The hosted search tool has a smaller window than the reasoning model.
	// Leave output and tool overhead headroom before entering that tool's limit.
	if searching {
		threshold = min(threshold, max(16*1024, 128000-p.MaxOutputTokensK*1024-8192))
	}
	return threshold
}
func addUsage(a, b Usage) Usage {
	return Usage{InputTokens: a.InputTokens + b.InputTokens, OutputTokens: a.OutputTokens + b.OutputTokens, TotalTokens: a.TotalTokens + b.TotalTokens}
}
