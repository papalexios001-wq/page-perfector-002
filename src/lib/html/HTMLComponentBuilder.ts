export class HTMLComponentBuilder {
  buildQuoteBox(
    quote: string,
    author?: string,
    color: 'blue' | 'green' | 'orange' | 'red' = 'blue'
  ): string {
    const colorClass = `quote-${color}`;
    return `
<blockquote class="quote-box ${colorClass}" style="border-left: 4px solid; padding: 15px 20px; margin: 20px 0; border-radius: 4px; background-color: #f5f5f5;">
  <p style="font-style: italic; margin: 0; font-size: 16px; line-height: 1.6;">
    &quot;${quote}&quot;
  </p>
  ${author ? `<footer style="margin-top: 10px; font-size: 14px; color: #666;">— ${author}</footer>` : ''}
</blockquote>
`;
  }

  buildTLDRBox(content: string | string[]): string {
    const items = Array.isArray(content) ? content : [content];
    const listItems = items
      .map((item) => `<li style="margin: 8px 0;">${item}</li>`)
      .join('');

    return `
<div class="tldr-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 20px; margin: 20px 0; color: white;">
  <h3 style="margin-top: 0; display: flex; align-items: center;">
    <span style="font-size: 20px; margin-right: 10px;">⚡</span>
    TL;DR (Too Long; Didn't Read)
  </h3>
  <ul style="margin: 10px 0; padding-left: 20px;">
    ${listItems}
  </ul>
</div>
`;
  }

  buildKeyTakeawaysBox(takeaways: string[]): string {
    const items = takeaways
      .map(
        (takeaway, index) => `
    <div style="margin: 12px 0; display: flex;">
      <span style="background: #4CAF50; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-weight: bold; flex-shrink: 0;">${index + 1}</span>
      <p style="margin: 0; flex: 1;">${takeaway}</p>
    </div>
  `
      )
      .join('');

    return `
<div class="key-takeaways" style="background: #e8f5e9; border-left: 4px solid #4CAF50; border-radius: 4px; padding: 20px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">🎯 Key Takeaways</h3>
  ${items}
</div>
`;
  }

  buildWarningBox(content: string): string {
    return `
<div class="warning-box" style="background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; padding: 15px; margin: 20px 0;">
  <p style="margin: 0; color: #856404; display: flex; align-items: center;">
    <span style="font-size: 20px; margin-right: 10px;">⚠️</span>
    <span>${content}</span>
  </p>
</div>
`;
  }

  buildSuccessBox(content: string): string {
    return `
<div class="success-box" style="background: #d4edda; border-left: 4px solid #28a745; border-radius: 4px; padding: 15px; margin: 20px 0;">
  <p style="margin: 0; color: #155724; display: flex; align-items: center;">
    <span style="font-size: 20px; margin-right: 10px;">✅</span>
    <span>${content}</span>
  </p>
</div>
`;
  }

  buildInfoBox(content: string): string {
    return `
<div class="info-box" style="background: #d1ecf1; border-left: 4px solid #17a2b8; border-radius: 4px; padding: 15px; margin: 20px 0;">
  <p style="margin: 0; color: #0c5460; display: flex; align-items: center;">
    <span style="font-size: 20px; margin-right: 10px;">ℹ️</span>
    <span>${content}</span>
  </p>
</div>
`;
  }

  buildStatisticBox(
    statistic: string,
    description: string,
    format: 'vertical' | 'horizontal' = 'vertical'
  ): string {
    if (format === 'horizontal') {
      return `
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 20px; margin: 20px 0; color: white; display: flex; align-items: center; justify-content: space-between;">
  <div>
    <p style="margin: 0; font-size: 14px; opacity: 0.9;">${description}</p>
  </div>
  <div style="font-size: 36px; font-weight: bold;">${statistic}</div>
</div>
`;
    }

    return `
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 25px; margin: 20px 0; color: white; text-align: center;">
  <p style="margin: 0; font-size: 14px; opacity: 0.9; margin-bottom: 8px;">${description}</p>
  <p style="margin: 0; font-size: 42px; font-weight: bold;">${statistic}</p>
</div>
`;
  }

  buildComparisonTable(headers: string[], rows: (string | number)[][]): string {
    const headerHtml = headers.map((h) => `<th style="padding: 12px; text-align: left; background: #f5f5f5; font-weight: bold; border-bottom: 2px solid #ddd;">${h}</th>`).join('');

    const rowsHtml = rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td style="padding: 12px; border-bottom: 1px solid #ddd;">${cell}</td>`)
            .join('')}</tr>`
      )
      .join('');

    return `
<table style="width: 100%; border-collapse: collapse; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden;">
  <thead>
    <tr>
      ${headerHtml}
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>
`;
  }

  buildActionBox(
    title: string,
    action: string,
    description?: string
  ): string {
    return `
<div class="action-box" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px; padding: 25px; margin: 20px 0; color: white; text-align: center;">
  <h3 style="margin: 0 0 10px 0; font-size: 20px;">${title}</h3>
  ${description ? `<p style="margin: 0 0 15px 0; opacity: 0.95; font-size: 14px;">${description}</p>` : ''}
  <button style="background: white; color: #f5576c; padding: 12px 30px; border: none; border-radius: 24px; font-weight: bold; cursor: pointer; font-size: 14px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
    ${action}
  </button>
</div>
`;
  }

  buildCodeBlock(
    code: string,
    language: string = 'javascript',
    showLineNumbers: boolean = true
  ): string {
    const lines = code.split('\n');
    const lineNumbersHtml = showLineNumbers
      ? lines
          .map((_, i) => `<span style="display: block; text-align: right; padding-right: 15px; color: #999;">${i + 1}</span>`)
          .join('')
      : '';

    const codeLines = lines
      .map((line) => `<span style="display: block; padding: 0; margin: 0;">${this.escapeHtml(line)}</span>`)
      .join('');

    return `
<div class="code-block" style="background: #2d2d2d; color: #f8f8f2; border-radius: 4px; padding: 15px; margin: 20px 0; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.5;">
  <div style="display: flex;">
    ${showLineNumbers ? `<div style="background: #1e1e1e; padding-right: 0; min-width: 40px;">${lineNumbersHtml}</div>` : ''}
    <div style="flex: 1; padding-left: 15px;">${codeLines}</div>
  </div>
</div>
`;
  }

  buildProsTrapeziumBox(pros: string[], cons: string[]): string {
    const prosList = pros.map((p) => `<li style="margin: 6px 0;">✅ ${p}</li>`).join('');
    const consList = cons.map((c) => `<li style="margin: 6px 0;">❌ ${c}</li>`).join('');

    return `
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
  <div style="background: #d4edda; border-left: 4px solid #28a745; border-radius: 4px; padding: 20px;">
    <h4 style="margin-top: 0; color: #155724;">Pros</h4>
    <ul style="margin: 0; padding-left: 20px; color: #155724;">
      ${prosList}
    </ul>
  </div>
  <div style="background: #f8d7da; border-left: 4px solid #dc3545; border-radius: 4px; padding: 20px;">
    <h4 style="margin-top: 0; color: #721c24;">Cons</h4>
    <ul style="margin: 0; padding-left: 20px; color: #721c24;">
      ${consList}
    </ul>
  </div>
</div>
`;
  }

  buildTimelineItem(
    year: string,
    title: string,
    description: string,
    index: number
  ): string {
    return `
<div style="display: flex; margin: 30px 0; position: relative;">
  <div style="min-width: 120px; font-weight: bold; color: #667eea;">${year}</div>
  <div style="flex: 1; padding-left: 20px; border-left: 2px solid #667eea; padding-bottom: 20px;">
    <h4 style="margin: 0 0 8px 0;">${title}</h4>
    <p style="margin: 0; color: #666; line-height: 1.6;">${description}</p>
  </div>
</div>
`;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  buildCustomBox(
    title: string,
    content: string,
    icon: string,
    backgroundColor: string = '#f5f5f5',
    borderColor: string = '#667eea'
  ): string {
    return `
<div style="background: ${backgroundColor}; border-left: 4px solid ${borderColor}; border-radius: 4px; padding: 20px; margin: 20px 0;">
  <h3 style="margin-top: 0; display: flex; align-items: center;">
    <span style="font-size: 24px; margin-right: 10px;">${icon}</span>
    ${title}
  </h3>
  <p style="margin: 0; line-height: 1.6;">${content}</p>
</div>
`;
  }
}

export default HTMLComponentBuilder;
