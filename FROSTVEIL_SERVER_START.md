# Start the Frostveil local test server

In PowerShell from the repository folder, run:

```powershell
.\server
```

The local `skyrim-rp` parent folder also has a forwarding `server.cmd`, so the same command works there. Double-clicking either file works independently of the current folder.

The checked-in entry reads the currently selected bundle from `build/dist/server/server-settings.json`. Deployment and rollback update that existing setting; the command stays unchanged. It verifies immutable code/editor hashes, local-only settings and occupied ports, then starts the existing server with the Beacon/Admin/Blueprint environment flags in the visible terminal. Ctrl+C stops it.

Console output appends to `build/rp-audit/server/server-console.log`. Existing deployment logs remain available. This command does not install mods or alter game/world/economy configuration.

For a read-only file/config check, including while the server is running:

```powershell
.\server --check
```

This convenience entry supports the verified Windows loopback test environment. It requires Node.js on PATH and an existing built/deployed server.
