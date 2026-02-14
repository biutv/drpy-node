# drpy-node MCP Skills & Prompts

## Skill 1: Develop DS Source (Create/Debug)
**Description:** Create, debug, and validate `drpy` JS spiders. Handles new sources, fixes, and advanced logic (encryption/lazy).

**Prompt Template:**
```markdown
Task: [Create/Debug/Analyze] DS Source for [URL/File]
Steps:
1. **Analyze/Fetch**: Use `fetch_spider_url` to inspect HTML/Headers or `read_file` to load existing code (auto-decrypted).
2. **Develop/Refine**:
    - Use `get_spider_template` for new files.
    - Implement `rule` object (see KB below).
    - For dynamic content, use `async` parsing or `lazy` loading.
    - For novels, `lazy` returns `novel://` + JSON.
3. **Validate**:
    - Save via `write_file` to `spider/js/[Name].js`.
    - Check syntax (`check_syntax`) and structure (`validate_spider`).
    - Test rules (`debug_spider_rule`) against real content.
```

## Skill 2: System Maintenance
**Description:** Monitor health, logs, DB, and config.

**Prompt Template:**
```markdown
Task: System Health & Config Check
Steps:
1. **Diagnose**: `read_logs` for errors, `get_routes_info` for APIs, `sql_query` for DB stats.
2. **Configure**: `manage_config` (get/set) to adjust settings (e.g., timeout).
3. **Apply**: `restart_service` if config changed.
```

## Knowledge Base (KB)

### 1. Source Structure (`rule` Object)
```javascript
var rule = {
    title: 'Site', host: 'https://site.com', url: '/cat/fyclass/p/fypage',
    searchUrl: '/s?k=**&p=fypage', searchable: 2, quickSearch: 0,
    headers: { 'User-Agent': 'MOBILE_UA' },
    class_name: 'Mov&TV', class_url: 'mov&tv', // or async class_parse
    play_parse: true,
    lazy: async function() { return { parse: 1, url: '...' } }, // or return 'url'
    一级: '.list li;a&&title;img&&src;.desc&&Text;a&&href', // List: selector;attr...
    二级: '*', // Detail: '*' or { title: '...', ... }
    搜索: '*', // Search: '*' or async function
}
```

### 2. Selectors (Cheerio-based)
Format: `selector;attr` or `selector;attr1;attr2`
| Func | Returns | Description |
| :--- | :--- | :--- |
| `pdfa` | Array | Parse List. |
| `pdfh` | String | Parse Node. |
| `pd` | String | Parse URL (auto-resolve). |

**Special Attrs**: `Text`, `Html`, `href`, `src`, `style`, `data-*`.
**Syntax**: `&&` (nested), `||` (backup), `:eq(n)` (index), `*` (all).

### 3. Advanced Patterns
**Async Parsing (`一级`/`二级`/`搜索`)**:
```javascript
一级: async function() {
    let { input, pdfa, pdfh, pd } = this;
    return pdfa(input, '.list li').map(it => ({
        title: pdfh(it, 'a&&title'), url: pd(it, 'a&&href')
    }));
}
```

**Batch Requests (`batchFetch`)**:
```javascript
let res = await batchFetch([{url:'...', options:{}}, ...]);
```

**Pre-processing (`预处理`)**:
```javascript
预处理: async function() { rule.classes = (await request('...')).classes; }
```

**Novel Content**:
```javascript
lazy: async function() { return { parse: 0, url: 'novel://' + JSON.stringify({title:'', content:''}) }; }
```

### 4. Global Helpers
| Helper | Description |
| :--- | :--- |
| `request(url, opt)` / `post` | Async HTTP GET/POST. |
| `log(msg)` | Console log (view in `read_logs`). |
| `setItem(k, v)` / `getItem(k)` | Persistent storage. |
| `urljoin(base, path)` | URL resolution. |

### 5. Content Type Specifics

- **Novels (`类型: '小说'`)**:
    - `lazy` should return `novel://` followed by a JSON string of `{ title, content }`.
    ```javascript
    lazy: async function() {
        let content = '...'; // Decrypted text
        let ret = JSON.stringify({ title: 'Chapter 1', content: content });
        return { parse: 0, url: 'novel://' + ret };
    }
    ```

- **Comics/Images (`类型: '漫画'`)**:
    - `lazy` should return `pics://` followed by image URLs joined by `&&`.
    ```javascript
    lazy: async function() {
        let pics = ['http://img1.jpg', 'http://img2.jpg'];
        return { parse: 0, url: 'pics://' + pics.join('&&') };
    }
    ```

## Tool Reference
| Tool | Usage |
| :--- | :--- |
| `fetch_spider_url` | Test connectivity/headers. |
| `debug_spider_rule` | Test CSS/Regex selectors. |
| `validate_spider` | Check `rule` structure. |
| `check_syntax` | Validate JS syntax. |
| `read_file` | Read & **Auto-Decrypt**. |
| `get_spider_template` | Standard template. |
| `manage_config` | Edit env.json. |