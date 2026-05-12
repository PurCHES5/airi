import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { cac } from 'cac'

async function main() {
  const cli = cac('artifacts-metadata')
    .option('--tag <tag>', 'Tag to use for the release version')
    .option('--get-version', 'Get the version from package.json')
    .option('--get-product-name', 'Get the product name from export_presets.cfg')
    .option('--get-bundle-name', 'Get the release filename for the current platform')
    .option('--get-filename <ext>', 'Get the release filename for a specific extension')
    .option('--get-output-filename <ext>', 'Get the Godot export output filename for a specific extension')

  const { options } = cli.parse()

  const projectRoot = process.cwd()
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const exportPresetsPath = path.join(projectRoot, 'export_presets.cfg')

  if (!fs.existsSync(packageJsonPath)) {
    console.error('package.json not found')
    process.exit(1)
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const exportPresets = fs.existsSync(exportPresetsPath) ? fs.readFileSync(exportPresetsPath, 'utf8') : ''

  // Determine Version (Tag overrides package.json)
  const rawTag = options.tag?.[0] || options.tag || ''
  const version = rawTag ? rawTag.replace(/^v/, '') : packageJson.version

  // Extract Product Name (prioritize export_presets.cfg then package.json)
  let productName = 'AIRI'
  const productNameMatch = exportPresets.match(/application\/product_name="([^"]+)"/)
  if (productNameMatch) {
    productName = productNameMatch[1]
  }
  else if (packageJson.productName) {
    productName = packageJson.productName
  }

  // Clean product name for filenames
  const safeProductName = productName.replace(/\s+/g, '-')

  // Handle CLI Flags
  if (options.getVersion) {
    process.stdout.write(version)
    return
  }

  if (options.getProductName) {
    process.stdout.write(productName)
    return
  }

  // Define architecture and platform mapping
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const platformMap: Record<string, { platform: string, ext: string, output: string }> = {
    win32: { platform: 'win', ext: 'exe', output: 'godot-stage.exe' },
    darwin: { platform: 'macos', ext: 'dmg', output: 'godot-stage.dmg' },
    linux: { platform: 'linux', ext: 'zip', output: 'godot-stage.zip' },
  }

  const current = platformMap[process.platform] || platformMap.linux

  // Returns the final filename used for the Release (e.g., AIRI-0.10.2-win-x64.exe)
  if (options.getBundleName) {
    const filename = `${safeProductName}-${version}-${current.platform}-${arch}.${current.ext}`
    process.stdout.write(filename)
    return
  }

  if (options.getFilename) {
    const ext = String(options.getFilename[0])
    let targetPlatform = current.platform

    // Heuristic for cross-platform filename requests
    if (ext === 'exe')
      targetPlatform = 'win'
    if (ext === 'dmg' || ext === 'app')
      targetPlatform = 'macos'
    if (ext === 'deb' || ext === 'rpm' || ext.includes('linux'))
      targetPlatform = 'linux'

    const filename = `${safeProductName}-${version}-${targetPlatform}-${arch}.${ext}`
    process.stdout.write(filename)
    return
  }

  // Returns the name Godot produces before renaming (based on export_presets.cfg)
  if (options.getOutputFilename) {
    const ext = String(options.getOutputFilename[0])
    const outputMap: Record<string, string> = {
      exe: 'godot-stage.exe',
      dmg: 'godot-stage.dmg',
      zip: 'godot-stage.zip',
      app: 'godot-stage.app',
    }
    process.stdout.write(outputMap[ext] || 'godot-stage')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
