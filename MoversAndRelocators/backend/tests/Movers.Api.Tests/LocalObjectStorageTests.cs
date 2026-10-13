using Microsoft.Extensions.Configuration;
using Movers.Api.Storage;

namespace Movers.Api.Tests;

public class LocalObjectStorageTests
{
    [Fact]
    public async Task Server_written_frames_replace_the_earlier_frame_with_the_same_key()
    {
        var root = Path.Combine(Path.GetTempPath(), "movers-local-" + Guid.NewGuid().ToString("N"));
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:LocalRoot"] = root }).Build();
        var storage = new LocalObjectStorage(configuration, null!, null!, TimeProvider.System);
        try
        {
            await storage.WriteAsync("tenant/leads/a/frames/frame-03.jpg", [1, 2, 3], "image/jpeg", default);
            await storage.WriteAsync("tenant/leads/a/frames/frame-03.jpg", [4, 5], "image/jpeg", default);
            Assert.Equal([4, 5], await File.ReadAllBytesAsync(storage.ObjectPath("tenant/leads/a/frames/frame-03.jpg")));
            Assert.Single(Directory.GetFiles(root, "*", SearchOption.AllDirectories));
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }
}
