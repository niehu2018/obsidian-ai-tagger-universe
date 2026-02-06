export interface Translations {
    // Settings sections
    settings: {
        llm: {
            title: string;
            serviceType: string;
            serviceTypeDesc: string;
            cloudProvider: string;
            cloudProviderDesc: string;
            localEndpoint: string;
            localEndpointDesc: string;
            modelName: string;
            modelNameDesc: string;
            temperature: string;
            temperatureDesc: string;
            temperaturePlaceholder: string;
            temperatureInvalid: string;
            apiEndpoint: string;
            apiEndpointDesc: string;
            apiKey: string;
            apiKeyDesc: string;
            connectionTest: string;
            connectionTestDesc: string;
            testConnection: string;
            testing: string;
            connectionSuccessful: string;
            connectionFailed: string;
            debugMode: string;
            debugModeDesc: string;
            debugEnabled: string;
            debugDisabled: string;
            tipsPopularTools: string;
        };
        tagging: {
            title: string;
            taggingMode: string;
            taggingModeDesc: string;
            mode: string;
            modeDesc: string;
            modePredefined: string;
            modeGenerate: string;
            modeHybrid: string;
            modeCustom: string;
            tagSource: string;
            tagSourceDesc: string;
            sourceFile: string;
            sourceVault: string;
            predefinedTagsFile: string;
            predefinedTagsFileDesc: string;
            fileExclusion: string;
            excludedFiles: string;
            excludedFilesDesc: string;
            manage: string;
            noExclusions: string;
            patternsConfigured: string;
            tagRangeSettings: string;
            maxPredefinedTags: string;
            maxPredefinedTagsDesc: string;
            maxGeneratedTags: string;
            maxGeneratedTagsDesc: string;
            outputLanguage: string;
            outputLanguageDesc: string;
            customPrompt: string;
            customPromptDesc: string;
            pathPlaceholder: string;
            customPromptPlaceholder: string;
            nestedTagsSettings: string;
            enableNestedTags: string;
            enableNestedTagsDesc: string;
            nestedTagsMaxDepth: string;
            nestedTagsMaxDepthDesc: string;
            tagFormatSettings: string;
            tagFormat: string;
            tagFormatDesc: string;
            tagFormatKebab: string;
            tagFormatCamel: string;
            tagFormatPascal: string;
            tagFormatSnake: string;
            tagFormatOriginal: string;
        };
        support: {
            title: string;
            description: string;
            supportText: string;
            buyMeACoffee: string;
            buyCoffee: string;
        };
        interface: {
            title: string;
            language: string;
            languageDesc: string;
        };
    };

    // Commands
    commands: {
        generateForCurrentNote: string;
        generateTagsForCurrentNote: string;
        generateForCurrentFolder: string;
        generateTagsForCurrentFolder: string;
        generateForVault: string;
        generateTagsForVault: string;
        clearTagsForCurrentNote: string;
        clearTagsForCurrentFolder: string;
        clearTagsForVault: string;
        collectAllTags: string;
        showTagNetwork: string;
        aiTagSelectedNotes: string;
        aiTagThisNote: string;
    };

    // Messages and notifications
    messages: {
        openNote: string;
        noContent: string;
        analyzing: string;
        failedToGenerate: string;
        operationCancelled: string;
        noMdFiles: string;
        noParentFolder: string;
        buildingTagNetwork: string;
        noTagsFound: string;
        noTagConnections: string;
        failedToBuildNetwork: string;
        successfullyClearedAll: string;
        failedToClearVault: string;
        pleaseOpenNote: string;
        failedToUpdate: string;
        analyzingFiles: string;
        successfullyTagged: string;
        progress: string;
        completed: string;
        connectionTestSuccess: string;
        connectionTestFailed: string;
        localServiceNotRunning: string;
        localServiceNotAvailable: string;
        tagsAlreadyUpToDate: string;
        noValidTags: string;
        errorClearingTags: string;
        errorUpdatingTags: string;
        tagsSavedTo: string;
        errorSavingTags: string;
        failedToLoadEndpoints: string;
        debugModeToggle: string;
        openNoteFirst: string;
        noParentFolderFound: string;
        noMarkdownFilesFound: string;
        noContentToAnalyze: string;
        failedToGenerateTags: string;
        generateTagsForFolderConfirm: string;
        generateTagsForVaultConfirm: string;
        generateTagsForSelectedConfirm: string;
        generateTagsInProgress: string;
        tagsGeneratedSuccessfully: string;
        failedToGenerateForFiles: string;
        progressPrefix: string;
        completedPrefix: string;
        restartRequired: string;
        languageChangeNotice: string;
        clearTagsForFolderConfirm: string;
        tagsClearedFrom: string;
        failedToClearTags: string;
        noTagsInVault: string;
        successfullyClearedAllVault: string;
        failedToClearVaultTags: string;
        viewTagNetwork: string;
        analyzeTagCurrentNote: string;
        noMatchingFiles: string;
        errorLoadingFiles: string;
        noActiveFile: string;
        noPredefinedTagsFound: string;
    };

    // Modal dialogs
    modals: {
        warning: string;
        confirm: string;
        cancel: string;
        clearAllTagsConfirm: string;
        generateFolderConfirm: string;
        generateVaultConfirm: string;
        generateSelectedConfirm: string;
        saveTagsConfirm: string;
        excludedFilesTitle: string;
        excludedFilesSubtitle: string;
        addButton: string;
        clearAllButton: string;
        clearAllConfirm: string;
        cancelButton: string;
        saveButton: string;
        noMatchingPaths: string;
        useAsPattern: string;
        moreResults: string;
        errorLoadingPaths: string;
        noExclusionsDefined: string;
        filterLabel: string;
        pathPlaceholder: string;
    };

    // File menu items
    fileMenu: {
        tagNetwork: string;
    };

    // Tag Network View
    tagNetwork: {
        title: string;
        description: string;
        searchPlaceholder: string;
        repulsionStrength: string;
        linkDistance: string;
        frequencyLow: string;
        frequencyMedium: string;
        frequencyHigh: string;
        clickToShowDocs: string;
        documentsWithTag: string;
        noDocuments: string;
        refresh: string;
    };

    // Dropdown options
    dropdowns: {
        localLLM: string;
        cloudService: string;
        openai: string;
        gemini: string;
        deepseek: string;
        aliyun: string;
        claude: string;
        groq: string;
        vertex: string;
        openrouter: string;
        bedrock: string;
        requesty: string;
        cohere: string;
        grok: string;
        mistral: string;
        glm: string;
        openaiCompatible: string;
        ollama: string;
        localai: string;
        lmStudio: string;
        jan: string;
        koboldcpp: string;
    };

    // Tips
    tips: {
        ollama: string;
        localai: string;
        lmStudio: string;
        jan: string;
        koboldcpp: string;
    };
}
