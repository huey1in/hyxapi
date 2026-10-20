package types

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCachedFileCloseReleasesMissingFileOnce(t *testing.T) {
	path := filepath.Join(t.TempDir(), "removed.tmp")
	data := NewDiskCachedData(path, "text/plain", 7)
	data.DiskSize = 12
	var calls int
	data.OnClose = func(size int64) {
		calls++
		if size != 12 {
			t.Errorf("released size = %d", size)
		}
	}
	for range 2 {
		if err := data.Close(); err != nil {
			t.Fatal(err)
		}
	}
	if calls != 1 {
		t.Fatalf("release calls = %d, want 1", calls)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("unexpected file: %v", err)
	}
}
