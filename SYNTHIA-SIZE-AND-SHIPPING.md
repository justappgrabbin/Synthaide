# Synthia Size / Shipping Split

The previous source checkpoint was large mainly because it embedded historical donor ZIP archives for provenance.

Those archives are valuable for the canonical source warehouse but are not runtime dependencies.

This lean checkpoint therefore:

- keeps active Synthia/Acode source;
- keeps restored source currently needed by the Living Mesh;
- keeps executable verification tests;
- keeps a SHA-256 index of donor archives;
- excludes the duplicate `synthia-donors/*.zip` warehouse from this runtime-test package.

The canonical checkpoint containing the original donor archives should remain preserved separately.

Rspack builds from explicit entry points and their imported dependency graph. Historical donor ZIP files are not imported application modules.
