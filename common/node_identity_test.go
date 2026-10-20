package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNodeIdentityManualAndHostname(t *testing.T) {
	previousName, previousSource, previousManual := NodeName, NodeNameSource, NodeNameManuallyConfigured
	t.Cleanup(func() {
		NodeName, NodeNameSource, NodeNameManuallyConfigured = previousName, previousSource, previousManual
	})
	t.Setenv("NODE_NAME", "configured-node")
	initNodeNameIdentity()
	require.Equal(t, NodeIdentity{Name: "configured-node", Source: NodeNameSourceManual, ManuallyConfigured: true}, GetNodeIdentity())
	t.Setenv("NODE_NAME", "")
	initNodeNameIdentity()
	require.NotEmpty(t, GetNodeIdentity().Name)
	require.Equal(t, NodeNameSourceHostname, GetNodeIdentity().Source)
	require.True(t, GetNodeIdentity().ShouldConfigureManually)
}
