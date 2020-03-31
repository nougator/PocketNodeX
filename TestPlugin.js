const PluginManifest = pocketnode("plugin/PluginManifest");
const PluginBase = pocketnode("plugin/PluginBase");


let manifest = new PluginManifest({
    name: "MyPlugin",
    version: "1.0.0",
    api: "1.0.0",
    author: "HerryYT",
    description: "a plugin"
});

class MyPlugin extends PluginBase {
    onEnable() {
        this.getLogger().info("enabled!");
    }
}

module.exports = {
    manifest: manifest,
    plugin: MyPlugin
};