.PHONY: check-runtime3d smoke-runtime3d smoke-runtime3d-dmg build-runtime3d-release

check-runtime3d:
	./scripts/check-runtime3d.sh

smoke-runtime3d:
	./scripts/smoke-runtime3d.sh

smoke-runtime3d-dmg:
	./scripts/smoke-runtime3d-dmg.sh

build-runtime3d-release:
	./scripts/build-runtime3d-release.sh
