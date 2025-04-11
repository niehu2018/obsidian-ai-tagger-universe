import { TFile, Notice } from 'obsidian';

export interface BatchProcessorOptions {
    batchSize: number;
    progressUpdateInterval: number;
    silent?: boolean;
}

export interface BatchProcessResult {
    success: boolean;
    processed: number;
    successCount: number;
    errors: Array<{ file: string; error: string }>;
}

export class BatchProcessor {
    private readonly options: BatchProcessorOptions;
    private isCancelled: boolean = false;

    constructor(options: Partial<BatchProcessorOptions> = {}) {
        this.options = {
            batchSize: 10,
            progressUpdateInterval: 5000,
            silent: false,
            ...options
        };
    }

    public cancel(): void {
        this.isCancelled = true;
    }

    public async processBatch<T>(
        files: TFile[],
        processor: (file: TFile) => Promise<T>
    ): Promise<BatchProcessResult> {
        const totalFiles = files.length;
        let processedCount = 0;
        let successCount = 0;
        let lastNoticeTime = Date.now();
        const errors: Array<{ file: string; error: string }> = [];

        // Split files into batches
        const batches: TFile[][] = [];
        for (let i = 0; i < files.length; i += this.options.batchSize) {
            batches.push(files.slice(i, i + this.options.batchSize));
        }

        // Process batches sequentially
        for (const batch of batches) {
            if (this.isCancelled) {
                break;
            }

            try {
                // Process files in current batch concurrently
                const batchResults = await Promise.all(
                    batch.map(async (file: TFile) => {
                        try {
                            await processor(file);
                            return true;
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                            errors.push({ file: file.path, error: errorMessage });
                            //console.error(`Error processing ${file.path}:`, errorMessage);
                            return false;
                        }
                    })
                );

                // Update counts
                const batchSuccesses = batchResults.filter(Boolean).length;
                successCount += batchSuccesses;
                processedCount += batch.length;

                // Show progress update if enough time has passed or we're done
                const currentTime = Date.now();
                if (!this.options.silent && (currentTime - lastNoticeTime >= this.options.progressUpdateInterval || processedCount === totalFiles)) {
                    new Notice(`${Math.round((processedCount/totalFiles) * 100)}%`);
                    lastNoticeTime = currentTime;
                }

            } catch (error) {
                //console.error('Error processing batch:', error);
            }
        }

        if (!this.options.silent && successCount > 0) {
            new Notice(`Cleared ${successCount} notes`);
        }

        return {
            success: errors.length === 0,
            processed: processedCount,
            successCount,
            errors
        };
    }
}
