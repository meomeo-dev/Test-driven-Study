package testsupport

import "testing"

// RequireDrivingBank marks tests that use the legacy driving question bank.
func RequireDrivingBank(t *testing.T) {
	t.Helper()
	t.Skip("requires the driving course fixture")
}


