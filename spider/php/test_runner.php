<?php
// test_runner.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

$file = $argv[1] ?? '';
if (!$file || !file_exists($file)) {
    die("File not found: $file\n");
}

echo "Testing $file ...\n";

try {
    // Use output buffering to suppress the output from (new Spider())->run() 
    // which is likely at the end of the included file.
    ob_start();
    require_once $file;
    ob_end_clean();

    if (!class_exists('Spider')) {
        die("Error: Class 'Spider' not found in $file\n");
    }

    $spider = new Spider();
    $spider->init(); 

    // --- 1. Home Interface ---
    echo "[TEST] Home Interface: ";
    $home = $spider->homeContent(true);
    
    $classes = $home['class'] ?? [];
    if (!empty($classes)) {
        echo "PASS (Classes: " . count($classes) . ")\n";
    } else {
        echo "WARNING (No classes found)\n";
    }

    // Determine type_id for Category test
    $tid = $classes[0]['type_id'] ?? null;
    if (!$tid && isset($home['filters'])) {
         // Try to find a key from filters if class is empty
         foreach ($home['filters'] as $key => $val) {
             $tid = $key; 
             break;
         }
    }

    // --- 2. Category Interface ---
    $vodId = null;
    if ($tid) {
        echo "[TEST] Category Interface (tid=$tid): ";
        $cat = $spider->categoryContent($tid, 1, [], []);
        $list = $cat['list'] ?? [];
        if (!empty($list)) {
            echo "PASS (Items: " . count($list) . ")\n";
            $vodId = $list[0]['vod_id'] ?? null;
        } else {
            echo "FAIL (No items returned)\n";
        }
    } else {
        echo "[TEST] Category Interface: SKIPPED (No type_id found)\n";
    }

    // --- 3. Detail Interface ---
    if ($vodId) {
        echo "[TEST] Detail Interface (id=$vodId): ";
        $detail = $spider->detailContent([$vodId]);
        $detailList = $detail['list'] ?? [];
        
        if (!empty($detailList)) {
            $vod = $detailList[0];
            $name = $vod['vod_name'] ?? 'Unknown';
            $playUrl = $vod['vod_play_url'] ?? '';
            echo "PASS (Name: $name)\n";
            
            if (empty($playUrl)) {
                echo "      WARNING: vod_play_url is empty!\n";
            }
        } else {
            echo "FAIL (No detail returned)\n";
        }
    } else {
        echo "[TEST] Detail Interface: SKIPPED (No vod_id found)\n";
    }

} catch (Throwable $e) {
    echo "\nCRITICAL ERROR: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . " Line: " . $e->getLine() . "\n";
}
echo "--------------------------------------------------\n";
