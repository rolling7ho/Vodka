// Draws Gmac's 1024px app icon: swiftc -O scripts/draw-icon.swift -o /tmp/draw-icon && /tmp/draw-icon icon.png
import AppKit
import CoreGraphics

let size = 1_024
let space = CGColorSpace(name: CGColorSpace.sRGB)!

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

func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
    CGPoint(x: 171.0 + x * 1.22, y: CGFloat(size) - (256.0 + y * 1.22))
}

func drawMark(in ctx: CGContext, scale: CGFloat = 1.0, yOffset: CGFloat = 0.0) {
    let path = CGMutablePath()
    func map(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        let p = pt(x, y)
        return CGPoint(
            x: 512.0 + (p.x - 512.0) * scale,
            y: 512.0 + (p.y - 512.0) * scale + yOffset
        )
    }
    path.move(to: map(87.5, 34.0))
    path.addCurve(to: map(36.0, 116.5), control1: map(49.4, 41.5), control2: map(34.8, 82.2))
    path.addCurve(to: map(242.5, 236.0), control1: map(31.5, 222.0), control2: map(165.4, 244.8))
    path.addCurve(to: map(56.0, 162.0), control1: map(182.6, 205.9), control2: map(115.8, 192.5))
    path.addCurve(to: map(301.0, 160.0), control1: map(136.8, 148.9), control2: map(221.0, 147.0))
    path.addCurve(to: map(524.0, 386.0), control1: map(417.0, 176.5), control2: map(503.6, 274.6))

    ctx.saveGState()
    ctx.addPath(path)
    ctx.setStrokeColor(color(0x713131))
    ctx.setLineWidth(9.0 * 1.22 * scale)
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)
    ctx.strokePath()
    ctx.restoreGState()
}

func renderSquircleIcon() -> CGImage {
    let ctx = makeContext()
    let body = CGRect(x: 100, y: 100, width: 824, height: 824)
    let tile = CGPath(roundedRect: body, cornerWidth: 185, cornerHeight: 185, transform: nil)

    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -18), blur: 28, color: CGColor(gray: 0, alpha: 0.18))
    ctx.addPath(tile)
    ctx.setFillColor(color(0xFFFFFF))
    ctx.fillPath()
    ctx.restoreGState()

    let borderRect = CGRect(x: 101, y: 101, width: 822, height: 822)
    let borderPath = CGPath(roundedRect: borderRect, cornerWidth: 184, cornerHeight: 184, transform: nil)
    ctx.addPath(borderPath)
    ctx.setStrokeColor(CGColor(gray: 0, alpha: 0.06))
    ctx.setLineWidth(2)
    ctx.strokePath()

    drawMark(in: ctx)
    return ctx.makeImage()!
}

func renderFullBleedTouchIcon() -> CGImage {
    let ctx = makeContext()
    ctx.setFillColor(color(0xFFFFFF))
    ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))
    drawMark(in: ctx, scale: 1.15)
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
    writePNG(renderSquircleIcon(), to: args[1], pixelSize: 1_024)
} else if args.count >= 3, args[1] == "--all" {
    let root = args[2]
    let squircle = renderSquircleIcon()
    let touch = renderFullBleedTouchIcon()

    writePNG(squircle, to: "\(root)/images/gmac-icon.png", pixelSize: 1_024)
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
        writePNG(squircle, to: "\(appIconDir)/\(name)", pixelSize: px)
    }
    writePNG(squircle, to: "\(root)/GmacThumbnail/Icons.xcassets/Icon.imageset/512R512x1.png", pixelSize: 512)
    writePNG(squircle, to: "\(root)/dist/pages/favicon-32.png", pixelSize: 32)
    writePNG(squircle, to: "\(root)/dist/pages/favicon-192.png", pixelSize: 192)
    writePNG(touch, to: "\(root)/dist/pages/apple-touch-icon.png", pixelSize: 180)
    print("Generated all Gmac PNG icons.")
} else {
    fputs("usage: draw-icon <out.png> | draw-icon --all <repo-root>\n", stderr)
    exit(1)
}
