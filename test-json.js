function tryFixTruncatedJSON(jsonStr) {
  let stack = [];
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }
  
  let result = jsonStr;
  if (inString) result += '"';
  
  // Remove trailing comma if it exists
  result = result.trim().replace(/,\s*$/, '');
  
  // If it ends with a colon, add a null value
  if (result.endsWith(':')) {
    result += ' null';
  }
  
  while (stack.length > 0) {
    result += stack.pop();
  }
  return result;
}

const text = `{"description":"abc\n`;

try {
  const fixed = tryFixTruncatedJSON(text);
  console.log("Fixed:", fixed);
  JSON.parse(fixed);
  console.log("Parsed successfully");
} catch (e) {
  console.error("Parse error:", e.message);
}
