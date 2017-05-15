'use strict';

module.exports = Delaunay;

function Delaunay(points) {

    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    var coords = this.coords = [];
    var ids = this.ids = [];

    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var x = p[0];
        var y = p[1];
        ids.push(i * 2);
        coords.push(x);
        coords.push(y);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }

    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;

    var minDist = Infinity;
    var i0;

    for (i = 0; i < coords.length; i += 2) {
        var d = dist(cx, cy, coords[i], coords[i + 1]);
        if (d < minDist) {
            i0 = i;
            minDist = d;
        }
    }

    minDist = Infinity;
    var i1;

    for (i = 0; i < coords.length; i += 2) {
        if (i === i0) continue;
        d = dist(coords[i0], coords[i0 + 1], coords[i], coords[i + 1]);
        if (d < minDist && d > 0) {
            i1 = i;
            minDist = d;
        }
    }

    var minRadius = Infinity;
    var i2;

    for (i = 0; i < coords.length; i += 2) {
        if (i === i0 || i === i1) continue;

        var r = circumradius(
            coords[i0], coords[i0 + 1],
            coords[i1], coords[i1 + 1],
            coords[i], coords[i + 1]);

        if (r < minRadius) {
            i2 = i;
            minRadius = r;
        }
    }

    if (area(coords[i0], coords[i0 + 1],
             coords[i1], coords[i1 + 1],
             coords[i2], coords[i2 + 1]) < 0) {

        var tmp = i1;
        i1 = i2;
        i2 = tmp;
    }

    var center = circumcenter(
        coords[i0], coords[i0 + 1],
        coords[i1], coords[i1 + 1],
        coords[i2], coords[i2 + 1]);

    quicksort(ids, coords, 0, ids.length - 1, center.x, center.y);

    this.hull = insertNode(coords, i0);
    this.hull.t = 0;
    this.hull = insertNode(coords, i1, this.hull);
    this.hull.t = 1;
    this.hull = insertNode(coords, i2, this.hull);
    this.hull.t = 2;

    var triangles = this.triangles = [i0, i1, i2];
    var adjacent = this.adjacent = [-1, -1, -1];

    var xp, yp;
    for (var k = 0; k < ids.length; k++) {
        i = ids[k];
        if (i === i0 || i === i1 || i === i2) continue;

        x = coords[i];
        y = coords[i + 1];

        // skip duplicate points
        if (x === xp && y === yp) continue;

        var e = this.hull;
        var walkBack = false;
        do {
            if (area(x, y, e.x, e.y, e.next.x, e.next.y) < 0) {
                walkBack = true;
                break;
            }
            e = e.next;
        } while (e !== this.hull);

        var t = addTriangle(triangles, i, e);

        adjacent[t] = -1;
        adjacent[t + 1] = -1;
        this._link(t + 2, e.t);

        e.t = t;
        e = insertNode(coords, i, e);
        e.t = this._legalize(t + 2);

        var q = e.next;
        while (area(x, y, q.x, q.y, q.next.x, q.next.y) < 0) {
            t = addTriangle(triangles, i, q);

            this._link(t, q.prev.t);
            adjacent[t + 1] = -1;
            this._link(t + 2, q.t);

            q.prev.t = this._legalize(t + 2);

            this.hull = removeNode(q);
            q = q.next;
        }

        if (!walkBack) continue;

        q = e.prev;
        while (area(x, y, q.prev.x, q.prev.y, q.x, q.y) < 0) {
            t = addTriangle(triangles, i, q.prev);

            adjacent[t] = -1;
            this._link(t + 1, q.t);
            this._link(t + 2, q.prev.t);

            this._legalize(t + 2);

            q.prev.t = t;
            this.hull = removeNode(q);
            q = q.prev;
        }

        xp = x;
        yp = y;
    }
}

Delaunay.prototype._legalize = function (a) {
    var b = this.adjacent[a];

    var a0 = a - a % 3;
    var b0 = b - b % 3;

    var al = a0 + (a + 1) % 3;
    var ar = a0 + (a + 2) % 3;
    var br = b0 + (b + 1) % 3;
    var bl = b0 + (b + 2) % 3;

    var p0 = this.triangles[ar];
    var pr = this.triangles[a];
    var pl = this.triangles[al];
    var p = this.triangles[bl];

    var illegal = inCircle(
        this.coords[p0], this.coords[p0 + 1],
        this.coords[pr], this.coords[pr + 1],
        this.coords[pl], this.coords[pl + 1],
        this.coords[p], this.coords[p + 1]);

    if (illegal) {
        this.triangles[a] = p;
        this.triangles[b] = p0;

        var aar = this.adjacent[ar];
        this._link(a, this.adjacent[bl]);
        this._link(ar, bl);
        this._link(b, aar);

        this._legalize(a);
        return this._legalize(br);
    }

    return ar;
};

Delaunay.prototype._link = function (a, b) {
    this.adjacent[a] = b;
    this.adjacent[b] = a;
};

function addTriangle(triangles, i, e) {
    var t = triangles.length;
    triangles[t] = e.i;
    triangles[t + 1] = i;
    triangles[t + 2] = e.next.i;
    return t;
}

function dist(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
}

function inCircle(ax, ay, bx, by, cx, cy, px, py) {
    ax -= px;
    ay -= py;
    bx -= px;
    by -= py;
    cx -= px;
    cy -= py;

    var ap = ax * ax + ay * ay;
    var bp = bx * bx + by * by;
    var cp = cx * cx + cy * cy;

    var det = ax * (by * cp - bp * cy) -
              ay * (bx * cp - bp * cx) +
              ap * (bx * cy - by * cx);

    return det < 0;
}

function circumradius(ax, ay, bx, by, cx, cy) {
    bx -= ax;
    by -= ay;
    cx -= ax;
    cy -= ay;

    var bl = bx * bx + by * by;
    var cl = cx * cx + cy * cy;

    if (bl === 0 || cl === 0) return Infinity;

    var d = bx * cy - by * cx;
    if (d === 0) return Infinity;

    var x = (cy * bl - by * cl) * 0.5 / d;
    var y = (bx * cl - cx * bl) * 0.5 / d;

    return x * x + y * y;
}

function area(px, py, qx, qy, rx, ry) {
    return (qy - py) * (rx - qx) - (qx - px) * (ry - qy);
}

function circumcenter(ax, ay, bx, by, cx, cy) {
    bx -= ax;
    by -= ay;
    cx -= ax;
    cy -= ay;

    var bl = bx * bx + by * by;
    var cl = cx * cx + cy * cy;

    var d = bx * cy - by * cx;

    var x = (cy * bl - by * cl) * 0.5 / d;
    var y = (bx * cl - cx * bl) * 0.5 / d;

    return {
        x: ax + x,
        y: ay + y
    };
}

// create a new node in a doubly linked list
function insertNode(coords, i, prev) {
    var node = {
        i: i,
        x: coords[i],
        y: coords[i + 1],
        t: 0,
        prev: null,
        next: null
    };

    if (!prev) {
        node.prev = node;
        node.next = node;

    } else {
        node.next = prev.next;
        node.prev = prev;
        prev.next.prev = node;
        prev.next = node;
    }
    return node;
}

function removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    return node.prev;
}

function quicksort(ids, coords, left, right, cx, cy) {
    var i, j, temp;

    if (right - left <= 20) {
        for (i = left + 1; i <= right; i++) {
            temp = ids[i];
            j = i - 1;
            while (j >= left && compare(coords, ids[j], temp, cx, cy) > 0) ids[j + 1] = ids[j--];
            ids[j + 1] = temp;
        }
    } else {
        var median = (left + right) >> 1;
        i = left + 1;
        j = right;
        swap(ids, median, i);
        if (compare(coords, ids[left], ids[right], cx, cy) > 0) swap(ids, left, right);
        if (compare(coords, ids[i], ids[right], cx, cy) > 0) swap(ids, i, right);
        if (compare(coords, ids[left], ids[i], cx, cy) > 0) swap(ids, left, i);

        temp = ids[i];
        while (true) {
            do i++; while (compare(coords, ids[i], temp, cx, cy) < 0);
            do j--; while (compare(coords, ids[j], temp, cx, cy) > 0);
            if (j < i) break;
            swap(ids, i, j);
        }
        ids[left + 1] = ids[j];
        ids[j] = temp;

        if (right - i + 1 >= j - left) {
            quicksort(ids, coords, i, right, cx, cy);
            quicksort(ids, coords, left, j - 1, cx, cy);
        } else {
            quicksort(ids, coords, left, j - 1, cx, cy);
            quicksort(ids, coords, i, right, cx, cy);
        }
    }
}

function compare(coords, i, j, cx, cy) {
    var d1 = dist(coords[i], coords[i + 1], cx, cy);
    var d2 = dist(coords[j], coords[j + 1], cx, cy);
    return (d1 - d2) || (coords[i] - coords[j]);
}

function swap(arr, i, j) {
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}