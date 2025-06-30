export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  rssMB: number;
}

export interface MemorySnapshot {
  timestamp: Date;
  stats: MemoryStats;
  label?: string;
}

// Store memory snapshots for leak detection
const memorySnapshots: MemorySnapshot[] = [];
const MAX_SNAPSHOTS = 100;

// Memory leak detection thresholds
const MEMORY_LEAK_THRESHOLD_MB = 50; // Alert if memory grows by 50MB
const MEMORY_LEAK_CHECK_INTERVAL = 10; // Check every 10 snapshots

export const getMemoryStats = (): MemoryStats => {
  const memUsage = process.memoryUsage();
  
  return {
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    external: memUsage.external,
    rss: memUsage.rss,
    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
    externalMB: Math.round(memUsage.external / 1024 / 1024),
    rssMB: Math.round(memUsage.rss / 1024 / 1024)
  };
};

export const logMemoryUsage = (label: string = 'Memory Usage'): void => {
  const stats = getMemoryStats();
  console.log(`${label}: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB (RSS: ${stats.rssMB}MB)`);
  
  // Store snapshot for leak detection
  storeMemorySnapshot(stats, label);
  
  // Check for memory leaks
  if (memorySnapshots.length >= MEMORY_LEAK_CHECK_INTERVAL) {
    checkForMemoryLeaks();
  }
};

export const isMemoryUsageHigh = (thresholdMB: number = 400): boolean => {
  const stats = getMemoryStats();
  return stats.heapUsedMB > thresholdMB;
};

const storeMemorySnapshot = (stats: MemoryStats, label?: string): void => {
  memorySnapshots.push({
    timestamp: new Date(),
    stats,
    label
  });
  
  // Keep only the last MAX_SNAPSHOTS
  if (memorySnapshots.length > MAX_SNAPSHOTS) {
    memorySnapshots.shift();
  }
};

const checkForMemoryLeaks = (): void => {
  if (memorySnapshots.length < MEMORY_LEAK_CHECK_INTERVAL) {
    return;
  }
  
  const recentSnapshots = memorySnapshots.slice(-MEMORY_LEAK_CHECK_INTERVAL);
  const firstSnapshot = recentSnapshots[0];
  const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
  
  const memoryGrowthMB = lastSnapshot.stats.heapUsedMB - firstSnapshot.stats.heapUsedMB;
  const timeDiffMinutes = (lastSnapshot.timestamp.getTime() - firstSnapshot.timestamp.getTime()) / (1000 * 60);
  
  if (memoryGrowthMB > MEMORY_LEAK_THRESHOLD_MB) {
    console.warn(`⚠️  Potential memory leak detected!`);
    console.warn(`   Memory grew by ${memoryGrowthMB}MB in ${timeDiffMinutes.toFixed(1)} minutes`);
    console.warn(`   From ${firstSnapshot.stats.heapUsedMB}MB to ${lastSnapshot.stats.heapUsedMB}MB`);
    
    // Force garbage collection if available
    if (global.gc) {
      console.log('   Forcing garbage collection...');
      global.gc();
      
      // Log memory after GC
      setTimeout(() => {
        const afterGC = getMemoryStats();
        console.log(`   Memory after GC: ${afterGC.heapUsedMB}MB`);
      }, 100);
    }
  }
};

// Memory optimization middleware
export const memoryOptimizationMiddleware = (req: any, res: any, next: any) => {
  // Track memory at request start
  const startMemory = getMemoryStats();
  
  // Override res.json to track memory after response
  const originalJson = res.json;
  res.json = function(data: any) {
    const endMemory = getMemoryStats();
    const memoryDiff = endMemory.heapUsedMB - startMemory.heapUsedMB;
    
    // Log if request caused significant memory increase
    if (memoryDiff > 10) {
      console.warn(`⚠️  Request ${req.method} ${req.path} increased memory by ${memoryDiff}MB`);
    }
    
    // Add memory stats to response headers
    res.setHeader('X-Memory-Used', `${endMemory.heapUsedMB}MB`);
    res.setHeader('X-Memory-Delta', `${memoryDiff > 0 ? '+' : ''}${memoryDiff}MB`);
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Periodic memory cleanup
export const startMemoryCleanup = (intervalMinutes: number = 5): NodeJS.Timer => {
  return setInterval(() => {
    const beforeGC = getMemoryStats();
    
    if (beforeGC.heapUsedMB > 300) {
      console.log(`🧹 Running periodic memory cleanup (current: ${beforeGC.heapUsedMB}MB)...`);
      
      // Clear any module caches
      if (require.cache) {
        const cacheKeys = Object.keys(require.cache);
        cacheKeys.forEach(key => {
          if (key.includes('node_modules') && !key.includes('express')) {
            delete require.cache[key];
          }
        });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        
        setTimeout(() => {
          const afterGC = getMemoryStats();
          const freed = beforeGC.heapUsedMB - afterGC.heapUsedMB;
          console.log(`   Freed ${freed}MB (now: ${afterGC.heapUsedMB}MB)`);
        }, 100);
      }
    }
  }, intervalMinutes * 60 * 1000);
};

// Export memory report
export const getMemoryReport = (): any => {
  const current = getMemoryStats();
  const snapshots = memorySnapshots.slice(-20); // Last 20 snapshots
  
  return {
    current,
    history: snapshots.map(s => ({
      timestamp: s.timestamp,
      heapUsedMB: s.stats.heapUsedMB,
      label: s.label
    })),
    alerts: {
      highMemoryUsage: isMemoryUsageHigh(),
      potentialLeak: memorySnapshots.length >= MEMORY_LEAK_CHECK_INTERVAL && 
        checkForMemoryLeaks() || false
    }
  };
};
