const missing = [];

const requiredSigning = ['CSC_LINK', 'CSC_KEY_PASSWORD'];
for (const key of requiredSigning) {
  if (!process.env[key] || !String(process.env[key]).trim()) {
    missing.push(key);
  }
}

const apiKeyAuth = ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'];
const appleIdAuth = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
const keychainAuth = ['APPLE_KEYCHAIN_PROFILE'];

const hasAll = (keys) => keys.every((key) => process.env[key] && String(process.env[key]).trim());
const hasAny = (keys) => keys.some((key) => process.env[key] && String(process.env[key]).trim());

let notarizationMode = null;
if (hasAll(apiKeyAuth)) {
  notarizationMode = 'api-key';
} else if (hasAll(appleIdAuth)) {
  notarizationMode = 'apple-id';
} else if (hasAll(keychainAuth)) {
  notarizationMode = 'keychain-profile';
} else if (hasAny(apiKeyAuth) || hasAny(appleIdAuth) || hasAny(keychainAuth)) {
  missing.push('完整的 notarization 环境变量组合');
}

if (!notarizationMode && !missing.includes('完整的 notarization 环境变量组合')) {
  missing.push('APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER 或 APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID 或 APPLE_KEYCHAIN_PROFILE');
}

if (missing.length > 0) {
  console.error('macOS 发布环境变量缺失:');
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log(`macOS 发布环境检查通过，notarization 模式: ${notarizationMode}`);
