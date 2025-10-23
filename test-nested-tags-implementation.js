#!/usr/bin/env node

/**
 * Automated Test Script for Nested Tags MVP Implementation
 * Validates settings, translations, and code structure
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

// Test results tracking
const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function testPassed(name) {
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    log(`  ✓ ${name}`, colors.green);
}

function testFailed(name, error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error });
    log(`  ✗ ${name}`, colors.red);
    if (error) log(`    Error: ${error}`, colors.red);
}

function testWarning(name, warning) {
    results.warnings++;
    results.tests.push({ name, status: 'WARN', warning });
    log(`  ⚠ ${name}`, colors.yellow);
    if (warning) log(`    Warning: ${warning}`, colors.yellow);
}

// Test 1: Verify settings.ts has new fields
function testSettingsSchema() {
    log('\n📋 Test 1: Settings Schema', colors.bold);

    const settingsPath = path.join(__dirname, 'src/core/settings.ts');
    const content = fs.readFileSync(settingsPath, 'utf8');

    // Check for enableNestedTags
    if (content.includes('enableNestedTags: boolean')) {
        testPassed('enableNestedTags field defined in interface');
    } else {
        testFailed('enableNestedTags field missing in interface');
    }

    // Check for nestedTagsMaxDepth
    if (content.includes('nestedTagsMaxDepth: number')) {
        testPassed('nestedTagsMaxDepth field defined in interface');
    } else {
        testFailed('nestedTagsMaxDepth field missing in interface');
    }

    // Check default values
    if (content.includes('enableNestedTags: false')) {
        testPassed('enableNestedTags default value set to false');
    } else {
        testFailed('enableNestedTags default value not set correctly');
    }

    if (content.includes('nestedTagsMaxDepth: 2')) {
        testPassed('nestedTagsMaxDepth default value set to 2');
    } else {
        testFailed('nestedTagsMaxDepth default value not set correctly');
    }
}

// Test 2: Verify prompt enhancements
function testPromptEnhancements() {
    log('\n💬 Test 2: Prompt Enhancements', colors.bold);

    const promptsPath = path.join(__dirname, 'src/services/prompts/tagPrompts.ts');
    const content = fs.readFileSync(promptsPath, 'utf8');

    // Check for nested tags instructions
    if (content.includes('nested_tags_requirements')) {
        testPassed('Nested tags instructions block added');
    } else {
        testFailed('Nested tags instructions block not found');
    }

    // Check for enableNestedTags check
    if (content.includes('pluginSettings?.enableNestedTags')) {
        testPassed('Settings check for enableNestedTags present');
    } else {
        testFailed('Settings check for enableNestedTags missing');
    }

    // Check for max depth reference
    if (content.includes('pluginSettings.nestedTagsMaxDepth')) {
        testPassed('Max depth setting referenced in prompt');
    } else {
        testFailed('Max depth setting not referenced in prompt');
    }

    // Check for examples
    const hasExamples = content.includes('technology/artificial-intelligence/machine-learning') ||
                       content.includes('science/biology/genetics');
    if (hasExamples) {
        testPassed('Nested tag examples provided in prompt');
    } else {
        testWarning('Nested tag examples might be missing', 'Examples help LLM understand format');
    }
}

// Test 3: Verify UI settings
function testUISettings() {
    log('\n🎨 Test 3: UI Settings', colors.bold);

    const uiPath = path.join(__dirname, 'src/ui/settings/TaggingSettingsSection.ts');
    const content = fs.readFileSync(uiPath, 'utf8');

    // Check for nested tags settings section
    if (content.includes('nestedTagsSettings')) {
        testPassed('Nested tags settings section added');
    } else {
        testFailed('Nested tags settings section not found');
    }

    // Check for toggle control
    if (content.includes('addToggle') && content.includes('enableNestedTags')) {
        testPassed('Toggle control for enableNestedTags present');
    } else {
        testFailed('Toggle control for enableNestedTags missing');
    }

    // Check for slider control
    if (content.includes('addSlider') && content.includes('nestedTagsMaxDepth')) {
        testPassed('Slider control for nestedTagsMaxDepth present');
    } else {
        testFailed('Slider control for nestedTagsMaxDepth missing');
    }

    // Check for proper limits
    if (content.includes('.setLimits(1, 3, 1)')) {
        testPassed('Slider limits set correctly (1-3)');
    } else {
        testWarning('Slider limits might not be set correctly', 'Should be 1-3 with step 1');
    }
}

// Test 4: Verify English translations
function testEnglishTranslations() {
    log('\n🇬🇧 Test 4: English Translations', colors.bold);

    const enPath = path.join(__dirname, 'src/i18n/en.ts');
    const content = fs.readFileSync(enPath, 'utf8');

    const requiredKeys = [
        'nestedTagsSettings',
        'enableNestedTags',
        'enableNestedTagsDesc',
        'nestedTagsMaxDepth',
        'nestedTagsMaxDepthDesc'
    ];

    requiredKeys.forEach(key => {
        if (content.includes(`${key}:`)) {
            testPassed(`English translation for '${key}' present`);
        } else {
            testFailed(`English translation for '${key}' missing`);
        }
    });
}

// Test 5: Verify Chinese translations
function testChineseTranslations() {
    log('\n🇨🇳 Test 5: Chinese Translations', colors.bold);

    const zhPath = path.join(__dirname, 'src/i18n/zh-cn.ts');
    const content = fs.readFileSync(zhPath, 'utf8');

    const requiredKeys = [
        'nestedTagsSettings',
        'enableNestedTags',
        'enableNestedTagsDesc',
        'nestedTagsMaxDepth',
        'nestedTagsMaxDepthDesc'
    ];

    requiredKeys.forEach(key => {
        if (content.includes(`${key}:`)) {
            testPassed(`Chinese translation for '${key}' present`);
        } else {
            testFailed(`Chinese translation for '${key}' missing`);
        }
    });

    // Check for Chinese characters
    if (content.includes('嵌套标签')) {
        testPassed('Chinese characters present in translations');
    } else {
        testWarning('Chinese characters might be missing', 'Should contain 嵌套标签');
    }
}

// Test 6: Verify translation types
function testTranslationTypes() {
    log('\n📝 Test 6: Translation Types', colors.bold);

    const typesPath = path.join(__dirname, 'src/i18n/types.ts');
    const content = fs.readFileSync(typesPath, 'utf8');

    const requiredKeys = [
        'nestedTagsSettings',
        'enableNestedTags',
        'enableNestedTagsDesc',
        'nestedTagsMaxDepth',
        'nestedTagsMaxDepthDesc'
    ];

    requiredKeys.forEach(key => {
        if (content.includes(`${key}: string`)) {
            testPassed(`Type definition for '${key}' present`);
        } else {
            testFailed(`Type definition for '${key}' missing`);
        }
    });
}

// Test 7: Verify build output
function testBuildOutput() {
    log('\n🔨 Test 7: Build Output', colors.bold);

    const mainJsPath = path.join(__dirname, 'main.js');

    if (fs.existsSync(mainJsPath)) {
        testPassed('main.js build output exists');

        const stats = fs.statSync(mainJsPath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        log(`    Build size: ${sizeKB} KB`, colors.cyan);

        if (stats.size > 100000) { // > 100KB
            testPassed('Build output size is reasonable');
        } else {
            testWarning('Build output seems too small', 'Might indicate build issues');
        }
    } else {
        testFailed('main.js build output not found', 'Run npm run build first');
    }
}

// Test 8: Cross-reference consistency
function testConsistency() {
    log('\n🔄 Test 8: Cross-Reference Consistency', colors.bold);

    // Read all relevant files
    const settingsContent = fs.readFileSync(path.join(__dirname, 'src/core/settings.ts'), 'utf8');
    const enContent = fs.readFileSync(path.join(__dirname, 'src/i18n/en.ts'), 'utf8');
    const zhContent = fs.readFileSync(path.join(__dirname, 'src/i18n/zh-cn.ts'), 'utf8');
    const typesContent = fs.readFileSync(path.join(__dirname, 'src/i18n/types.ts'), 'utf8');

    // Check that settings fields match translation keys
    const settingsHasEnable = settingsContent.includes('enableNestedTags');
    const enHasEnable = enContent.includes('enableNestedTags:');
    const zhHasEnable = zhContent.includes('enableNestedTags:');
    const typesHasEnable = typesContent.includes('enableNestedTags: string');

    if (settingsHasEnable && enHasEnable && zhHasEnable && typesHasEnable) {
        testPassed('enableNestedTags consistent across all files');
    } else {
        testFailed('enableNestedTags inconsistent',
            `Settings:${settingsHasEnable} EN:${enHasEnable} ZH:${zhHasEnable} Types:${typesHasEnable}`);
    }

    const settingsHasDepth = settingsContent.includes('nestedTagsMaxDepth');
    const enHasDepth = enContent.includes('nestedTagsMaxDepth:');
    const zhHasDepth = zhContent.includes('nestedTagsMaxDepth:');
    const typesHasDepth = typesContent.includes('nestedTagsMaxDepth: string');

    if (settingsHasDepth && enHasDepth && zhHasDepth && typesHasDepth) {
        testPassed('nestedTagsMaxDepth consistent across all files');
    } else {
        testFailed('nestedTagsMaxDepth inconsistent',
            `Settings:${settingsHasDepth} EN:${enHasDepth} ZH:${zhHasDepth} Types:${typesHasDepth}`);
    }
}

// Generate test report
function generateReport() {
    log('\n' + '='.repeat(60), colors.bold);
    log('📊 TEST REPORT', colors.bold + colors.cyan);
    log('='.repeat(60), colors.bold);

    const total = results.passed + results.failed + results.warnings;
    const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;

    log(`\nTotal Tests: ${total}`);
    log(`✓ Passed: ${results.passed}`, colors.green);
    log(`✗ Failed: ${results.failed}`, colors.red);
    log(`⚠ Warnings: ${results.warnings}`, colors.yellow);
    log(`Pass Rate: ${passRate}%`, passRate >= 90 ? colors.green : colors.yellow);

    if (results.failed === 0) {
        log('\n🎉 All tests passed! Nested Tags MVP implementation is complete.', colors.green + colors.bold);
        log('✅ Ready for manual testing in Obsidian.', colors.green);
    } else {
        log('\n⚠️  Some tests failed. Please review the implementation.', colors.yellow);
    }

    if (results.warnings > 0) {
        log(`\n⚠️  ${results.warnings} warning(s) detected. Review recommended but not critical.`, colors.yellow);
    }

    log('\n' + '='.repeat(60), colors.bold);

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run all tests
function runAllTests() {
    log('\n' + '='.repeat(60), colors.bold);
    log('🧪 NESTED TAGS MVP - AUTOMATED TEST SUITE', colors.bold + colors.cyan);
    log('='.repeat(60), colors.bold);
    log('\nRunning automated validation tests...\n');

    try {
        testSettingsSchema();
        testPromptEnhancements();
        testUISettings();
        testEnglishTranslations();
        testChineseTranslations();
        testTranslationTypes();
        testBuildOutput();
        testConsistency();

        generateReport();
    } catch (error) {
        log('\n❌ Fatal error during testing:', colors.red);
        log(error.message, colors.red);
        process.exit(1);
    }
}

// Execute tests
runAllTests();
