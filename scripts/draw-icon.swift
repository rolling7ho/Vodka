// Draws Gmac's 1024px app icon: swiftc -O scripts/draw-icon.swift -o /tmp/draw-icon && /tmp/draw-icon --all .
import AppKit
import CoreGraphics

let size = 1_024
let space = CGColorSpace(name: CGColorSpace.sRGB)!

enum Appearance {
    case light
    case dark
}

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(
        srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
        green: CGFloat((hex >> 8) & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255,
        alpha: alpha
    )
}

func makeContext(width: Int = size, height: Int = size) -> CGContext {
    CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: space,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
}

func makeRadialMask(size: Int, center: CGPoint, radius: CGFloat) -> CGImage {
    let graySpace = CGColorSpaceCreateDeviceGray()
    let ctx = CGContext(
        data: nil,
        width: size,
        height: size,
        bitsPerComponent: 8,
        bytesPerRow: size,
        space: graySpace,
        bitmapInfo: CGImageAlphaInfo.none.rawValue
    )!
    ctx.setFillColor(gray: 0.05, alpha: 1.0)
    ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))

    let grad = CGGradient(
        colorsSpace: graySpace,
        colors: [
            CGColor(gray: 1.0, alpha: 1.0),
            CGColor(gray: 1.0, alpha: 1.0),
            CGColor(gray: 0.05, alpha: 1.0)
        ] as CFArray,
        locations: [0.0, 0.25, 1.0]
    )!
    ctx.drawRadialGradient(
        grad,
        startCenter: center,
        startRadius: 0,
        endCenter: center,
        endRadius: radius,
        options: [.drawsAfterEndLocation]
    )
    return ctx.makeImage()!
}

func drawBlueprintGrid(in ctx: CGContext, appearance: Appearance) {
    let gridHex: UInt32 = appearance == .light ? 0x713131 : 0xE09898
    let gridAlpha: CGFloat = appearance == .light ? 0.065 : 0.09
    let diagAlpha: CGFloat = appearance == .light ? 0.04 : 0.055

    let mask = makeRadialMask(size: size, center: CGPoint(x: 512, y: 512), radius: 412)
    ctx.saveGState()
    ctx.clip(to: CGRect(x: 0, y: 0, width: size, height: size), mask: mask)

    ctx.setStrokeColor(color(gridHex, gridAlpha))
    ctx.setLineWidth(1.5)
    for pos in stride(from: 128, through: 896, by: 64) {
        let p = CGFloat(pos)
        ctx.move(to: CGPoint(x: p, y: 100))
        ctx.addLine(to: CGPoint(x: p, y: 924))
        ctx.move(to: CGPoint(x: 100, y: p))
        ctx.addLine(to: CGPoint(x: 924, y: p))
    }
    ctx.strokePath()

    ctx.setStrokeColor(color(gridHex, diagAlpha))
    ctx.move(to: CGPoint(x: 100, y: 100))
    ctx.addLine(to: CGPoint(x: 924, y: 924))
    ctx.move(to: CGPoint(x: 924, y: 100))
    ctx.addLine(to: CGPoint(x: 100, y: 924))
    ctx.strokePath()

    ctx.restoreGState()
}

func map400(_ x: CGFloat, _ y: CGFloat, scale: CGFloat) -> CGPoint {
    let px = 92.0 + x * 2.1
    let py = CGFloat(size) - (92.0 + y * 2.1)
    return CGPoint(
        x: 512.0 + (px - 512.0) * scale,
        y: 512.0 + (py - 512.0) * scale
    )
}

func drawMark(in ctx: CGContext, appearance: Appearance, scale: CGFloat = 1.0) {
    let arcColor = appearance == .light ? color(0x713131) : color(0xF5ECEC)
    let playColor = appearance == .light ? color(0x713131) : color(0xD98282)
    let center = CGPoint(x: 512, y: 512)
    let lineWidth = 22.8 * 2.1 * scale

    // Micro Play glyph
    let play = CGMutablePath()
    play.move(to: map400(189, 183, scale: scale))
    play.addLine(to: map400(217, 200, scale: scale))
    play.addLine(to: map400(189, 217, scale: scale))
    play.closeSubpath()

    ctx.saveGState()
    ctx.addPath(play)
    ctx.setFillColor(playColor)
    ctx.fillPath()
    ctx.addPath(play)
    ctx.setStrokeColor(playColor)
    ctx.setLineWidth(5.0 * 2.1 * scale)
    ctx.setLineJoin(.round)
    ctx.strokePath()
    ctx.restoreGState()

    // Outer G arc + crossbar
    let outerPath = CGMutablePath()
    let outerStart = atan2(83.0, 92.1)
    outerPath.addArc(
        center: center,
        radius: 124.0 * 2.1 * scale,
        startAngle: outerStart,
        endAngle: 0,
        clockwise: false
    )
    outerPath.addLine(to: map400(248, 200, scale: scale))

    // Inner concentric arc
    let innerPath = CGMutablePath()
    let innerStart = atan2(45.5, 50.5)
    let innerEnd = atan2(-58.9, 34.0)
    innerPath.addArc(
        center: center,
        radius: 68.0 * 2.1 * scale,
        startAngle: innerStart,
        endAngle: innerEnd,
        clockwise: false
    )

    ctx.saveGState()
    ctx.setStrokeColor(arcColor)
    ctx.setLineWidth(lineWidth)
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)
    ctx.addPath(outerPath)
    ctx.strokePath()
    ctx.addPath(innerPath)
    ctx.strokePath()
    ctx.restoreGState()
}

func renderSquircleIcon(appearance: Appearance) -> CGImage {
    let ctx = makeContext()
    let body = CGRect(x: 100, y: 100, width: 824, height: 824)
    let tile = CGPath(roundedRect: body, cornerWidth: 185, cornerHeight: 185, transform: nil)

    // Drop shadow + base fill
    ctx.saveGState()
    let shadowAlpha: CGFloat = appearance == .light ? 0.18 : 0.45
    ctx.setShadow(offset: CGSize(width: 0, height: -18), blur: 28, color: CGColor(gray: 0, alpha: shadowAlpha))
    ctx.addPath(tile)
    if appearance == .light {
        ctx.setFillColor(color(0xFFFFFF))
        ctx.fillPath()
    } else {
        ctx.setFillColor(color(0x191212))
        ctx.fillPath()
    }
    ctx.restoreGState()

    // Clip to squircle for gradient + blueprint grid
    ctx.saveGState()
    ctx.addPath(tile)
    ctx.clip()
    if appearance == .dark {
        let grad = CGGradient(
            colorsSpace: space,
            colors: [color(0x281D1D), color(0x191212)] as CFArray,
            locations: [0.0, 1.0]
        )!
        ctx.drawLinearGradient(
            grad,
            start: CGPoint(x: 512, y: 924),
            end: CGPoint(x: 512, y: 100),
            options: []
        )
    }
    drawBlueprintGrid(in: ctx, appearance: appearance)
    ctx.restoreGState()

    // Crisp inner hairline border
    let borderRect = CGRect(x: 101, y: 101, width: 822, height: 822)
    let borderPath = CGPath(roundedRect: borderRect, cornerWidth: 184, cornerHeight: 184, transform: nil)
    ctx.addPath(borderPath)
    ctx.setStrokeColor(appearance == .light ? CGColor(gray: 0, alpha: 0.06) : CGColor(gray: 1, alpha: 0.16))
    ctx.setLineWidth(2)
    ctx.strokePath()

    drawMark(in: ctx, appearance: appearance)
    return ctx.makeImage()!
}

func renderFullBleedTouchIcon() -> CGImage {
    let ctx = makeContext()
    ctx.setFillColor(color(0xFFFFFF))
    ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))
    drawBlueprintGrid(in: ctx, appearance: .light)
    drawMark(in: ctx, appearance: .light, scale: 1.15)
    return ctx.makeImage()!
}

func renderTransparentFavicon() -> CGImage {
    let ctx = makeContext()
    drawMark(in: ctx, appearance: .light, scale: 1.55)
    return ctx.makeImage()!
}

func writePNG(_ image: CGImage, to path: String, pixelSize: Int) {
    let ctx = makeContext(width: pixelSize, height: pixelSize)
    ctx.interpolationQuality = .high
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: pixelSize, height: pixelSize))
    let scaled = ctx.makeImage()!
    let rep = NSBitmapImageRep(cgImage: scaled)
    let data = rep.representation(using: .png, properties: [:])!
    try! data.write(to: URL(fileURLWithPath: path))
}

let args = CommandLine.arguments
if args.count == 2 {
    writePNG(renderSquircleIcon(appearance: .light), to: args[1], pixelSize: 1_024)
} else if args.count == 3, args[1] == "--dark" {
    writePNG(renderSquircleIcon(appearance: .dark), to: args[2], pixelSize: 1_024)
} else if args.count >= 3, args[1] == "--all" {
    let root = args[2]
    let lightSquircle = renderSquircleIcon(appearance: .light)
    let darkSquircle = renderSquircleIcon(appearance: .dark)
    let touch = renderFullBleedTouchIcon()
    let favicon = renderTransparentFavicon()

    writePNG(lightSquircle, to: "\(root)/images/gmac-icon.png", pixelSize: 1_024)
    writePNG(darkSquircle, to: "\(root)/images/gmac-icon-dark.png", pixelSize: 1_024)

    let appIconDir = "\(root)/Gmac/Assets.xcassets/AppIcon.appiconset"
    let appSizes: [(String, Int)] = [
        ("16R64x1.png", 16),
        ("16@2x.png", 32),
        ("32R64x1.png", 32),
        ("32@2x.png", 64),
        ("128R128x1.png", 128),
        ("128@2x.png", 256),
        ("256R256x1.png", 256),
        ("256@2x.png", 512),
        ("512R512x1.png", 512),
        ("512@2x.png", 1_024)
    ]
    for (name, px) in appSizes {
        writePNG(lightSquircle, to: "\(appIconDir)/\(name)", pixelSize: px)
    }

    let adaptiveDir = "\(root)/Gmac/Assets.xcassets/AdaptiveAppIcon.imageset"
    try FileManager.default.createDirectory(atPath: adaptiveDir, withIntermediateDirectories: true)
    writePNG(lightSquircle, to: "\(adaptiveDir)/512@2x.png", pixelSize: 1_024)
    writePNG(darkSquircle, to: "\(adaptiveDir)/512@2x-dark.png", pixelSize: 1_024)

    writePNG(lightSquircle, to: "\(root)/GmacThumbnail/Icons.xcassets/Icon.imageset/512R512x1.png", pixelSize: 512)
    writePNG(darkSquircle, to: "\(root)/GmacThumbnail/Icons.xcassets/Icon.imageset/512R512x1-dark.png", pixelSize: 512)

    writePNG(favicon, to: "\(root)/dist/pages/favicon-32.png", pixelSize: 32)
    writePNG(favicon, to: "\(root)/dist/pages/favicon-192.png", pixelSize: 192)
    writePNG(touch, to: "\(root)/dist/pages/apple-touch-icon.png", pixelSize: 180)
    print("Generated all Light and Dark Gmac PNG icons.")
} else {
    fputs("usage: draw-icon <out.png> | draw-icon --dark <out.png> | draw-icon --all <repo-root>\n", stderr)
    exit(1)
}
