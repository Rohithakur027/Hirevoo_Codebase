export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Only import and start worker in Node.js runtime (not Edge)
        const { startWorker } = await import('./workers/index');
        await startWorker();
    }
}
