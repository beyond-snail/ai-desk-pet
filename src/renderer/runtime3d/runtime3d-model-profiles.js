(() => {
  const profiles = {
    caterpillar: {
      modelId: 'caterpillar-v1',
      rig: 'runtime3d.shared.biped.v1',
      source: 'placeholder-svg-proxy',
      placeholderAsset: 'characters/caterpillar/template.html',
      targetModelAsset: 'runtime3d/models/caterpillar/caterpillar-v1.glb',
      animationSet: 'runtime3d.animset.default.v1'
    },
    'cyber-bot': {
      modelId: 'cyber-bot-v1',
      rig: 'runtime3d.shared.biped.v1',
      source: 'placeholder-svg-proxy',
      placeholderAsset: 'characters/cyber-bot/template.html',
      targetModelAsset: 'runtime3d/models/cyber-bot/cyber-bot-v1.glb',
      animationSet: 'runtime3d.animset.default.v1'
    },
    'pixel-pet': {
      modelId: 'pixel-pet-v1',
      rig: 'runtime3d.shared.biped.v1',
      source: 'placeholder-svg-proxy',
      placeholderAsset: 'characters/pixel-pet/template.html',
      targetModelAsset: 'runtime3d/models/pixel-pet/pixel-pet-v1.glb',
      animationSet: 'runtime3d.animset.default.v1'
    },
    'rainbow-bot': {
      modelId: 'rainbow-bot-v1',
      rig: 'runtime3d.shared.biped.v1',
      source: 'placeholder-svg-proxy',
      placeholderAsset: 'characters/rainbow-bot/template.html',
      targetModelAsset: 'runtime3d/models/rainbow-bot/rainbow-bot-v1.glb',
      animationSet: 'runtime3d.animset.default.v1'
    }
  };

  function resolveProfile(characterId) {
    const key = String(characterId || '').trim();
    if (!key) {
      return null;
    }

    const profile = profiles[key];
    if (!profile) {
      return null;
    }

    return {
      characterId: key,
      ...profile
    };
  }

  window.Runtime3DModelProfiles = profiles;
  window.resolveRuntime3dModelProfile = resolveProfile;
})();
