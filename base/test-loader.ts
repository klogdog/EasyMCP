/**
 * Test script for the module loader
 */

import { loadModules } from "./loader";
import * as path from "path";

async function test() {
    console.log("Testing Module Loader...\n");

    try {
        // Load modules from the workspace root
        const basePath = path.join(__dirname, "..");
        console.log(`Loading modules from: ${basePath}\n`);

        const modules = await loadModules(basePath);

        console.log(`Found ${modules.length} modules:\n`);

        // Display each module
        modules.forEach((module, index) => {
            console.log(`${index + 1}. ${module.name}`);
            console.log(`   Type: ${module.type}`);
            console.log(`   Language: ${module.language}`);
            console.log(`   Path: ${module.path}`);
            console.log(`   Description: ${module.metadata.description}`);
            console.log(`   Version: ${module.metadata.version}`);

            if ("capabilities" in module.metadata && module.metadata.capabilities) {
                console.log(`   Capabilities: ${module.metadata.capabilities.join(", ")}`);
            }

            if ("type" in module.metadata) {
                console.log(`   Connector Type: ${module.metadata.type}`);
            }

            if ("methods" in module.metadata && module.metadata.methods) {
                console.log(`   Methods: ${module.metadata.methods.join(", ")}`);
            }

            console.log();
        });

        // Summary
        const tools = modules.filter((m) => m.type === "tool");
        const connectors = modules.filter((m) => m.type === "connector");
        const tsModules = modules.filter((m) => m.language === "typescript");
        const pyModules = modules.filter((m) => m.language === "python");

        console.log("Summary:");
        console.log(`  Total modules: ${modules.length}`);
        console.log(`  Tools: ${tools.length}`);
        console.log(`  Connectors: ${connectors.length}`);
        console.log(`  TypeScript: ${tsModules.length}`);
        console.log(`  Python: ${pyModules.length}`);

        console.log("\n✅ Test completed successfully!");
    } catch (error) {
        console.error("❌ Test failed:", error);
        process.exit(1);
    }
}

test();
