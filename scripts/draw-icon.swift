// Draws Vodka's 1024px app icon: swiftc -O scripts/draw-icon.swift -o /tmp/draw-icon && /tmp/draw-icon icon.png
import AppKit
import CoreImage

// Vodka's icon: a heavy tumbler of iced vodka on the accent colour,
// RGB 221 54 111. Drawn in layers with blur so it reads as glass, not flat shapes.

let size = 1024
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let ci = CIContext(options: [.workingColorSpace: space])

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(
        srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255, alpha: alpha
    )
}

func white(_ alpha: CGFloat) -> CGColor { CGColor(gray: 1, alpha: alpha) }

func makeContext() -> CGContext {
    CGContext(
        data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: space,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
}

func layer(_ draw: (CGContext) -> Void) -> CGImage {
    let ctx = makeContext()
    draw(ctx)
    return ctx.makeImage()!
}

func blur(_ image: CGImage, _ radius: CGFloat) -> CGImage {
    let input = CIImage(cgImage: image).clampedToExtent()
    let output = input.applyingGaussianBlur(sigma: radius).cropped(to: CGRect(x: 0, y: 0, width: size, height: size))
    return ci.createCGImage(output, from: output.extent, format: .RGBA8, colorSpace: space)!
}

func gradient(_ colors: [CGColor], _ locations: [CGFloat]) -> CGGradient {
    CGGradient(colorsSpace: space, colors: colors as CFArray, locations: locations)!
}

let full = CGRect(x: 0, y: 0, width: size, height: size)

// MARK: Shapes

/// Apple's continuous-corner squircle, as a superellipse.
func squircle(_ rect: CGRect, exponent: CGFloat = 5) -> CGPath {
    let path = CGMutablePath()
    let a = rect.width / 2, b = rect.height / 2
    let cx = rect.midX, cy = rect.midY
    for step in 0...720 {
        let t = CGFloat(step) / 720 * 2 * .pi
        let c = cos(t), s = sin(t)
        let x = cx + a * (c < 0 ? -1 : 1) * pow(abs(c), 2 / exponent)
        let y = cy + b * (s < 0 ? -1 : 1) * pow(abs(s), 2 / exponent)
        step == 0 ? path.move(to: CGPoint(x: x, y: y)) : path.addLine(to: CGPoint(x: x, y: y))
    }
    path.closeSubpath()
    return path
}

let body = CGRect(x: 100, y: 100, width: 824, height: 824)
let tile = CGPath(roundedRect: body, cornerWidth: 186, cornerHeight: 186, transform: nil)

// The glass, seen a little from above: elliptical rim and base.
let rimY: CGFloat = 742, baseY: CGFloat = 262
let rimRX: CGFloat = 214, rimRY: CGFloat = 44
let baseRX: CGFloat = 168, baseRY: CGFloat = 34
let cx: CGFloat = 512

func halfWidth(at y: CGFloat) -> CGFloat {
    baseRX + (rimRX - baseRX) * (y - baseY) / (rimY - baseY)
}
func radiusY(at y: CGFloat) -> CGFloat {
    baseRY + (rimRY - baseRY) * (y - baseY) / (rimY - baseY)
}

/// Lower or upper half of a horizontal ellipse, left to right.
func addHalfEllipse(_ path: CGMutablePath, center: CGPoint, rx: CGFloat, ry: CGFloat, lower: Bool, from left: Bool = true) {
    let steps = 120
    for step in 0...steps {
        var t = CGFloat(step) / CGFloat(steps) * .pi
        if !left { t = .pi - t }
        let x = center.x - rx * cos(t)
        let y = center.y + (lower ? -1 : 1) * ry * sin(t)
        path.addLine(to: CGPoint(x: x, y: y))
    }
}

func ellipse(_ center: CGPoint, _ rx: CGFloat, _ ry: CGFloat) -> CGPath {
    CGPath(ellipseIn: CGRect(x: center.x - rx, y: center.y - ry, width: rx * 2, height: ry * 2), transform: nil)
}

/// Silhouette: down the left wall, round the front of the base, up the right
/// wall, back over the far side of the rim.
let glass: CGPath = {
    let path = CGMutablePath()
    path.move(to: CGPoint(x: cx - rimRX, y: rimY))
    path.addLine(to: CGPoint(x: cx - baseRX, y: baseY))
    addHalfEllipse(path, center: CGPoint(x: cx, y: baseY), rx: baseRX, ry: baseRY, lower: true)
    path.addLine(to: CGPoint(x: cx + rimRX, y: rimY))
    addHalfEllipse(path, center: CGPoint(x: cx, y: rimY), rx: rimRX, ry: rimRY, lower: false, from: false)
    path.closeSubpath()
    return path
}()

/// The space inside the walls, which are a few points thick.
let wall: CGFloat = 13
let floorY: CGFloat = 318
let interior: CGPath = {
    let path = CGMutablePath()
    let top = rimY - 2
    path.move(to: CGPoint(x: cx - halfWidth(at: top) + wall, y: top))
    path.addLine(to: CGPoint(x: cx - halfWidth(at: floorY) + wall, y: floorY))
    addHalfEllipse(
        path, center: CGPoint(x: cx, y: floorY), rx: halfWidth(at: floorY) - wall, ry: radiusY(at: floorY) - 4,
        lower: true
    )
    path.addLine(to: CGPoint(x: cx + halfWidth(at: top) - wall, y: top))
    addHalfEllipse(
        path, center: CGPoint(x: cx, y: top), rx: halfWidth(at: top) - wall, ry: radiusY(at: top) - 4,
        lower: false, from: false
    )
    path.closeSubpath()
    return path
}()

let surfaceY: CGFloat = 548
let liquid: CGPath = {
    let path = CGMutablePath()
    let rx = halfWidth(at: surfaceY) - wall, ry = radiusY(at: surfaceY) - 4
    path.move(to: CGPoint(x: cx - rx, y: surfaceY))
    path.addLine(to: CGPoint(x: cx - halfWidth(at: floorY) + wall, y: floorY))
    addHalfEllipse(
        path, center: CGPoint(x: cx, y: floorY), rx: halfWidth(at: floorY) - wall, ry: radiusY(at: floorY) - 4,
        lower: true
    )
    path.addLine(to: CGPoint(x: cx + rx, y: surfaceY))
    addHalfEllipse(path, center: CGPoint(x: cx, y: surfaceY), rx: rx, ry: ry, lower: false, from: false)
    path.closeSubpath()
    return path
}()

// MARK: Ice

struct Vec { var x, y, z: CGFloat }

func rotate(_ v: Vec, _ ax: CGFloat, _ ay: CGFloat, _ az: CGFloat) -> Vec {
    var p = v
    p = Vec(x: p.x, y: p.y * cos(ax) - p.z * sin(ax), z: p.y * sin(ax) + p.z * cos(ax))
    p = Vec(x: p.x * cos(ay) + p.z * sin(ay), y: p.y, z: -p.x * sin(ay) + p.z * cos(ay))
    p = Vec(x: p.x * cos(az) - p.y * sin(az), y: p.x * sin(az) + p.y * cos(az), z: p.z)
    return p
}

/// A cube with softened edges, lit from the upper left. Faces facing the
/// viewer are drawn back to front with their own shade.
func drawCube(_ ctx: CGContext, center: CGPoint, side: CGFloat, angles: (CGFloat, CGFloat, CGFloat)) {
    let h = side / 2
    let corners = [
        Vec(x: -h, y: -h, z: -h), Vec(x: h, y: -h, z: -h), Vec(x: h, y: h, z: -h), Vec(x: -h, y: h, z: -h),
        Vec(x: -h, y: -h, z: h), Vec(x: h, y: -h, z: h), Vec(x: h, y: h, z: h), Vec(x: -h, y: h, z: h)
    ].map { rotate($0, angles.0, angles.1, angles.2) }
    let faces: [[Int]] = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]]
    let light = Vec(x: -0.45, y: 0.75, z: 0.5)
    var visible: [(depth: CGFloat, path: CGPath, shade: CGFloat, top: CGPoint, bottom: CGPoint)] = []
    for face in faces {
        let pts = face.map { corners[$0] }
        let u = Vec(x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y, z: pts[1].z - pts[0].z)
        let v = Vec(x: pts[3].x - pts[0].x, y: pts[3].y - pts[0].y, z: pts[3].z - pts[0].z)
        var n = Vec(x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x)
        let centroid = pts.reduce(Vec(x: 0, y: 0, z: 0)) { Vec(x: $0.x + $1.x / 4, y: $0.y + $1.y / 4, z: $0.z + $1.z / 4) }
        if n.x * centroid.x + n.y * centroid.y + n.z * centroid.z < 0 { n = Vec(x: -n.x, y: -n.y, z: -n.z) }
        let len = sqrt(n.x * n.x + n.y * n.y + n.z * n.z)
        n = Vec(x: n.x / len, y: n.y / len, z: n.z / len)
        guard n.z > 0.02 else { continue }
        let shade = max(0, n.x * light.x + n.y * light.y + n.z * light.z)
        // Inset and round the face so edges read as melted, not machined.
        let projected = pts.map { CGPoint(x: center.x + $0.x, y: center.y + $0.y) }
        let mid = projected.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x / 4, y: $0.y + $1.y / 4) }
        let inset = projected.map { CGPoint(x: mid.x + ($0.x - mid.x) * 0.97, y: mid.y + ($0.y - mid.y) * 0.97) }
        let path = CGMutablePath()
        let start = CGPoint(x: (inset[3].x + inset[0].x) / 2, y: (inset[3].y + inset[0].y) / 2)
        path.move(to: start)
        for i in 0..<4 {
            path.addArc(tangent1End: inset[i], tangent2End: inset[(i + 1) % 4], radius: side * 0.14)
        }
        path.closeSubpath()
        let ys = inset.map(\.y)
        visible.append((centroid.z, path, shade, CGPoint(x: mid.x, y: ys.max()!), CGPoint(x: mid.x, y: ys.min()!)))
    }
    for face in visible.sorted(by: { $0.depth < $1.depth }) {
        ctx.saveGState()
        ctx.addPath(face.path)
        ctx.clip()
        let lit = 0.3 + 0.7 * face.shade
        ctx.drawLinearGradient(
            gradient([white(0.12 + lit * 0.7), color(0xFFE4EE, 0.06 + lit * 0.36)], [0, 1]),
            start: face.top, end: face.bottom, options: []
        )
        ctx.restoreGState()
        // Only the lit faces get a bright edge; the rest fade into the vodka.
        if face.shade > 0.6 {
            ctx.addPath(face.path)
            ctx.setStrokeColor(white(0.85))
            ctx.setLineWidth(2.5)
            ctx.strokePath()
        }
    }
    // Cloudy core where the water froze last.
    let core = layer { layer in
        layer.addPath(ellipse(CGPoint(x: center.x - side * 0.05, y: center.y + side * 0.06), side * 0.22, side * 0.16))
        layer.setFillColor(white(0.55))
        layer.fillPath()
    }
    ctx.draw(blur(core, side * 0.09), in: full)
}

// MARK: Drawing

let ctx = makeContext()

// Drop shadow under the tile.
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -14), blur: 30, color: color(0x000000, 0.38))
ctx.addPath(tile)
ctx.setFillColor(color(0xB02A58))
ctx.fillPath()
ctx.restoreGState()

ctx.saveGState()
ctx.addPath(tile)
ctx.clip()

// Accent background: lit from the top left, deepening to plum.
ctx.drawLinearGradient(
    gradient([color(0xF2709A), color(0xDD366F), color(0x9C1E4F), color(0x5A1036)], [0, 0.38, 0.75, 1]),
    start: CGPoint(x: 230, y: 940), end: CGPoint(x: 820, y: 90), options: []
)
// A pool of light behind the glass.
ctx.drawRadialGradient(
    gradient([color(0xFFD3E2, 0.55), color(0xFF8AB0, 0.18), color(0xFF8AB0, 0)], [0, 0.45, 1]),
    startCenter: CGPoint(x: 500, y: 600), startRadius: 0,
    endCenter: CGPoint(x: 500, y: 600), endRadius: 430, options: []
)

// The glass's shadow and the bright caustic it throws, both soft.
let shadow = layer { layer in
    layer.addPath(ellipse(CGPoint(x: cx + 46, y: baseY - 26), baseRX + 30, baseRY + 14))
    layer.setFillColor(color(0x3A0420, 0.55))
    layer.fillPath()
}
ctx.draw(blur(shadow, 22), in: full)
let caustic = layer { layer in
    layer.addPath(ellipse(CGPoint(x: cx + 30, y: baseY - 18), baseRX * 0.62, baseRY * 0.55))
    layer.setFillColor(color(0xFFE3EE, 0.75))
    layer.fillPath()
}
ctx.draw(blur(caustic, 12), in: full)

// Inside the glass: the background seen through it, flipped and paler.
ctx.saveGState()
ctx.addPath(glass)
ctx.clip()
ctx.drawLinearGradient(
    gradient([color(0xFFC2D6, 0.55), color(0xE0487E, 0.25), color(0xFFE1EB, 0.5)], [0, 0.55, 1]),
    start: CGPoint(x: cx - rimRX, y: rimY), end: CGPoint(x: cx + rimRX, y: baseY), options: []
)
ctx.restoreGState()

// Far wall, slightly shaded, seen above the vodka.
ctx.saveGState()
ctx.addPath(interior)
ctx.clip()
ctx.drawLinearGradient(
    gradient([white(0.10), white(0.02)], [0, 1]),
    start: CGPoint(x: cx, y: rimY), end: CGPoint(x: cx, y: surfaceY), options: []
)

// Ice, partly under the surface.
drawCube(ctx, center: CGPoint(x: 540, y: 425), side: 118, angles: (0.75, 0.35, 0.55))
drawCube(ctx, center: CGPoint(x: 442, y: 560), side: 150, angles: (0.5, 0.55, 0.2))
drawCube(ctx, center: CGPoint(x: 600, y: 566), side: 134, angles: (0.45, -0.6, -0.28))

// The vodka: clear, so it mostly softens what is behind and below it.
ctx.saveGState()
ctx.addPath(liquid)
ctx.clip()
ctx.drawLinearGradient(
    gradient([color(0xFFF4F8, 0.30), color(0xFFE6EF, 0.22), color(0xFFFFFF, 0.42)], [0, 0.6, 1]),
    start: CGPoint(x: cx, y: surfaceY), end: CGPoint(x: cx, y: floorY - 40), options: []
)
// Refraction: a darker band down each side of the liquid.
ctx.drawLinearGradient(
    gradient([color(0x8E1A4A, 0.22), color(0x8E1A4A, 0), color(0x8E1A4A, 0), color(0x8E1A4A, 0.28)], [0, 0.18, 0.8, 1]),
    start: CGPoint(x: cx - rimRX, y: 0), end: CGPoint(x: cx + rimRX, y: 0), options: []
)
ctx.restoreGState()

// Surface, with a bright meniscus along its near edge.
let surfaceRX = halfWidth(at: surfaceY) - wall, surfaceRY = radiusY(at: surfaceY) - 4
ctx.addPath(ellipse(CGPoint(x: cx, y: surfaceY), surfaceRX, surfaceRY))
ctx.setFillColor(white(0.16))
ctx.fillPath()
let meniscus = layer { layer in
    let path = CGMutablePath()
    path.move(to: CGPoint(x: cx - surfaceRX, y: surfaceY))
    addHalfEllipse(path, center: CGPoint(x: cx, y: surfaceY), rx: surfaceRX, ry: surfaceRY, lower: true)
    layer.addPath(path)
    layer.setStrokeColor(white(0.95))
    layer.setLineWidth(5)
    layer.strokePath()
    let back = CGMutablePath()
    back.move(to: CGPoint(x: cx - surfaceRX, y: surfaceY))
    addHalfEllipse(back, center: CGPoint(x: cx, y: surfaceY), rx: surfaceRX, ry: surfaceRY, lower: false)
    layer.addPath(back)
    layer.setStrokeColor(white(0.45))
    layer.setLineWidth(3)
    layer.strokePath()
}
ctx.draw(blur(meniscus, 1.2), in: full)

// Bubbles rising off the ice.
var seed: UInt64 = 0x5EED
func random() -> CGFloat {
    seed = seed &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
    return CGFloat(seed >> 33) / CGFloat(UInt32.max >> 1)
}
for _ in 0..<7 {
    let y = floorY + 20 + random() * (surfaceY - floorY - 60)
    let x = cx + (random() - 0.5) * 2 * (halfWidth(at: y) - 50)
    let r = 2.5 + random() * 4
    ctx.addPath(ellipse(CGPoint(x: x, y: y), r, r))
    ctx.setStrokeColor(white(0.55))
    ctx.setLineWidth(1.5)
    ctx.strokePath()
    ctx.addPath(ellipse(CGPoint(x: x - r * 0.35, y: y + r * 0.35), r * 0.3, r * 0.3))
    ctx.setFillColor(white(0.85))
    ctx.fillPath()
}
ctx.restoreGState()

// The heavy base: solid glass under the floor, catching light at its edges.
ctx.saveGState()
let baseBlock = CGMutablePath()
baseBlock.move(to: CGPoint(x: cx - halfWidth(at: floorY), y: floorY))
baseBlock.addLine(to: CGPoint(x: cx - baseRX, y: baseY))
addHalfEllipse(baseBlock, center: CGPoint(x: cx, y: baseY), rx: baseRX, ry: baseRY, lower: true)
baseBlock.addLine(to: CGPoint(x: cx + halfWidth(at: floorY), y: floorY))
addHalfEllipse(
    baseBlock, center: CGPoint(x: cx, y: floorY), rx: halfWidth(at: floorY), ry: radiusY(at: floorY),
    lower: true, from: false
)
baseBlock.closeSubpath()
ctx.addPath(baseBlock)
ctx.clip()
ctx.drawLinearGradient(
    gradient([white(0.55), white(0.2), white(0.6)], [0, 0.5, 1]),
    start: CGPoint(x: cx - baseRX, y: 0), end: CGPoint(x: cx + baseRX, y: 0), options: []
)
ctx.restoreGState()
let floorEdge = layer { layer in
    let path = CGMutablePath()
    path.move(to: CGPoint(x: cx - halfWidth(at: floorY) + wall, y: floorY))
    addHalfEllipse(
        path, center: CGPoint(x: cx, y: floorY), rx: halfWidth(at: floorY) - wall, ry: radiusY(at: floorY) - 4,
        lower: true
    )
    layer.addPath(path)
    layer.setStrokeColor(white(0.9))
    layer.setLineWidth(4)
    layer.strokePath()
}
ctx.draw(blur(floorEdge, 1.5), in: full)

// Wall thickness: a pale band between the outside and inside of each wall.
ctx.saveGState()
ctx.addPath(glass)
ctx.addPath(interior)
ctx.addPath(baseBlock)
ctx.clip(using: .evenOdd)
ctx.setFillColor(white(0.30))
ctx.fill(full)
ctx.restoreGState()

// Specular streaks: a broad soft one down the left wall, a thin one on the right.
let streaks = layer { layer in
    layer.addPath(glass)
    layer.clip()
    let left = CGMutablePath()
    left.move(to: CGPoint(x: cx - rimRX + 34, y: rimY - 30))
    left.addLine(to: CGPoint(x: cx - rimRX + 74, y: rimY - 30))
    left.addLine(to: CGPoint(x: cx - baseRX + 62, y: baseY + 40))
    left.addLine(to: CGPoint(x: cx - baseRX + 30, y: baseY + 40))
    left.closeSubpath()
    layer.addPath(left)
    layer.setFillColor(white(0.55))
    layer.fillPath()
    let right = CGMutablePath()
    right.move(to: CGPoint(x: cx + rimRX - 26, y: rimY - 40))
    right.addLine(to: CGPoint(x: cx + rimRX - 16, y: rimY - 40))
    right.addLine(to: CGPoint(x: cx + baseRX - 14, y: baseY + 60))
    right.addLine(to: CGPoint(x: cx + baseRX - 22, y: baseY + 60))
    right.closeSubpath()
    layer.addPath(right)
    layer.setFillColor(white(0.5))
    layer.fillPath()
}
ctx.draw(blur(streaks, 7), in: full)
let glint = layer { layer in
    layer.addPath(glass)
    layer.clip()
    layer.setFillColor(white(0.95))
    layer.fill(CGRect(x: cx - rimRX + 44, y: rimY - 230, width: 9, height: 170))
}
ctx.draw(blur(glint, 2.5), in: full)

// Condensation on the cold outside of the glass, below the vodka line.
for _ in 0..<70 {
    let y = baseY + 40 + random() * (surfaceY - baseY - 50)
    let x = cx + (random() - 0.5) * 2 * (halfWidth(at: y) - 12)
    let r = 2 + pow(random(), 2) * 7
    ctx.addPath(ellipse(CGPoint(x: x, y: y - r * 0.15), r, r * 1.12))
    ctx.setFillColor(color(0x7A1440, 0.18))
    ctx.fillPath()
    ctx.addPath(ellipse(CGPoint(x: x, y: y), r * 0.85, r * 0.95))
    ctx.setFillColor(white(0.22))
    ctx.fillPath()
    ctx.addPath(ellipse(CGPoint(x: x - r * 0.3, y: y + r * 0.35), r * 0.28, r * 0.28))
    ctx.setFillColor(white(0.9))
    ctx.fillPath()
}

// Outline: fine bright edges, strongest where light hits.
ctx.addPath(glass)
ctx.setStrokeColor(white(0.75))
ctx.setLineWidth(3)
ctx.setLineJoin(.round)
ctx.strokePath()

// Rim: the far side dim, the near side bright and thick.
let rim = layer { layer in
    let back = CGMutablePath()
    back.move(to: CGPoint(x: cx - rimRX, y: rimY))
    addHalfEllipse(back, center: CGPoint(x: cx, y: rimY), rx: rimRX, ry: rimRY, lower: false)
    layer.addPath(back)
    layer.setStrokeColor(white(0.7))
    layer.setLineWidth(4)
    layer.strokePath()
    let front = CGMutablePath()
    front.move(to: CGPoint(x: cx - rimRX, y: rimY))
    addHalfEllipse(front, center: CGPoint(x: cx, y: rimY), rx: rimRX, ry: rimRY, lower: true)
    layer.addPath(front)
    layer.setStrokeColor(white(0.95))
    layer.setLineWidth(7)
    layer.strokePath()
    let inner = CGMutablePath()
    inner.move(to: CGPoint(x: cx - rimRX + wall, y: rimY))
    addHalfEllipse(inner, center: CGPoint(x: cx, y: rimY), rx: rimRX - wall, ry: rimRY - 5, lower: true)
    layer.addPath(inner)
    layer.setStrokeColor(white(0.4))
    layer.setLineWidth(3)
    layer.strokePath()
}
ctx.draw(blur(rim, 1), in: full)
let sparkle = layer { layer in
    layer.addPath(ellipse(CGPoint(x: cx - rimRX + 70, y: rimY - rimRY + 10), 22, 7))
    layer.setFillColor(white(1))
    layer.fillPath()
}
ctx.draw(blur(sparkle, 4), in: full)

// Tile edge: a lit top bevel and a darker lower lip.
ctx.addPath(tile)
ctx.setLineWidth(6)
ctx.replacePathWithStrokedPath()
ctx.clip()
ctx.drawLinearGradient(
    gradient([white(0.45), white(0.0), color(0x2A0016, 0.35)], [0, 0.45, 1]),
    start: CGPoint(x: 0, y: 924), end: CGPoint(x: 0, y: 100), options: []
)
ctx.restoreGState()

// Fine grain over the tile, so gradients don't look vector-smooth.
let image = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: image)
if let data = rep.bitmapData {
    let bytesPerRow = rep.bytesPerRow
    for y in 0..<size {
        for x in 0..<size {
            let i = y * bytesPerRow + x * 4
            let alpha = Int(data[i + 3])
            guard alpha > 200 else { continue }
            let noise = Int(random() * 9) - 4
            for c in 0..<3 {
                data[i + c] = UInt8(max(0, min(alpha, Int(data[i + c]) + noise)))
            }
        }
    }
}
let out = CommandLine.arguments[1]
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
