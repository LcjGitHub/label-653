class TurndownService {
  constructor(options) {
    this.options = options || {};
  }

  turndown(html) {
    if (!html) return '';
    let result = html;
    result = result.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    result = result.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    result = result.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    result = result.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    result = result.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    result = result.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    result = result.replace(/<br\s*\/?>/gi, '\n');
    result = result.replace(/<[^>]+>/g, '');
    return result.trim();
  }
}

module.exports = TurndownService;
