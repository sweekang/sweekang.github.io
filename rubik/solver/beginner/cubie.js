import * as THREE from 'three';
import { Move } from '/solver/beginner/move.js';

function* enumerate (it, start = 0) { let i = start
  for (const x of it)
    yield [i++, x]
}

class Cubie {
    FACINGS = 'FBRLUD';
    COLORS = 'ROGBYW';

    constructor (kwargs) {
        // kwargs is just a dict >:/ i hate js
        this.facings = {}
        for (var [key, value] of Object.entries(kwargs)){
            key = key.toUpperCase()
            this.facings[key] = value
        }
    }


    faces() {return Object.keys(this.facings)}

    colors() {return Object.values(this.facings)}

    static init_facing_to_color(facing) {return 'ROGBYW'['FBRLUD'.indexOf(facing.toUpperCase())]}
    static init_color_to_facing(color) {return 'FBRLUD'['ROGBYW'.indexOf(color.toUpperCase())]}

    facing_to_color(facing) {return this.COLORS[this.FACINGS.indexOf(facing.toUpperCase())]}

    color_to_facing(color) {return this.FACINGS[this.COLORS.indexOf(color.toUpperCase())]}

    color_facing(c) {
        for (const [facing, color] of Object.entries(this.facings)){
            if (color == c) {return facing}
        }
        return null
    }
}

class Center extends Cubie {
    constructor (kwargs) {
        super(kwargs);
    }
}

class Edge extends Cubie {
    constructor (kwargs) {
        super(kwargs);
    }
}

class Corner extends Cubie {
    constructor (kwargs) {
        super(kwargs);
    }
}

class Cube {
    MOVES = {
        'F': [
            ['FLU', 'FUR'],
            ['FUR', 'FRD'],
            ['FRD', 'FDL'],
            ['FDL', 'FLU'],
            ['FU', 'FR'],
            ['FR', 'FD'],
            ['FD', 'FL'],
            ['FL', 'FU']
        ],
        'B': [
            ['BLU', 'BDL'],
            ['BDL', 'BRD'],
            ['BRD', 'BUR'],
            ['BUR', 'BLU'],
            ['BU', 'BL'],
            ['BL', 'BD'],
            ['BD', 'BR'],
            ['BR', 'BU']
        ],
        'R': [
            ['RFU', 'RUB'],
            ['RUB', 'RBD'],
            ['RBD', 'RDF'],
            ['RDF', 'RFU'],
            ['RU', 'RB'],
            ['RB', 'RD'],
            ['RD', 'RF'],
            ['RF', 'RU']
        ],
        'L': [
            ['LFU', 'LDF'],
            ['LDF', 'LBD'],
            ['LBD', 'LUB'],
            ['LUB', 'LFU'],
            ['LU', 'LF'],
            ['LF', 'LD'],
            ['LD', 'LB'],
            ['LB', 'LU']
        ],
        'U': [
            ['ULB', 'UBR'],
            ['UBR', 'URF'],
            ['URF', 'UFL'],
            ['UFL', 'ULB'],
            ['UB', 'UR'],
            ['UR', 'UF'],
            ['UF', 'UL'],
            ['UL', 'UB']
        ],
        'D': [
            ['DFL', 'DRF'],
            ['DRF', 'DBR'],
            ['DBR', 'DLB'],
            ['DLB', 'DFL'],
            ['DF', 'DR'],
            ['DR', 'DB'],
            ['DB', 'DL'],
            ['DL', 'DF']
        ],
        'X': [
            ['RFU', 'RUB'],
            ['RUB', 'RBD'],
            ['RBD', 'RDF'],
            ['RDF', 'RFU'],
            ['RU', 'RB'],
            ['RB', 'RD'],
            ['RD', 'RF'],
            ['RF', 'RU'],
            ['LDF', 'LFU'],
            ['LBD', 'LDF'],
            ['LUB', 'LBD'],
            ['LFU', 'LUB'],
            ['LF', 'LU'],
            ['LD', 'LF'],
            ['LB', 'LD'],
            ['LU', 'LB'],
            ['FU', 'UB'],
            ['UB', 'BD'],
            ['BD', 'DF'],
            ['DF', 'FU'],
            ['F', 'U'],
            ['U', 'B'],
            ['B', 'D'],
            ['D', 'F'],
        ],
        'Y': [
            ['ULB', 'UBR'],
            ['UBR', 'URF'],
            ['URF', 'UFL'],
            ['UFL', 'ULB'],
            ['UB', 'UR'],
            ['UR', 'UF'],
            ['UF', 'UL'],
            ['UL', 'UB'],
            ['DRF', 'DFL'],
            ['DBR', 'DRF'],
            ['DLB', 'DBR'],
            ['DFL', 'DLB'],
            ['DR', 'DF'],
            ['DB', 'DR'],
            ['DL', 'DB'],
            ['DF', 'DL'],
            ['FR', 'LF'],
            ['LF', 'BL'],
            ['BL', 'RB'],
            ['RB', 'FR'],
            ['F', 'L'],
            ['L', 'B'],
            ['B', 'R'],
            ['R', 'F']
        ],

        'Z': [
            ['FLU', 'FUR'],
            ['FUR', 'FRD'],
            ['FRD', 'FDL'],
            ['FDL', 'FLU'],
            ['FU', 'FR'],
            ['FR', 'FD'],
            ['FD', 'FL'],
            ['FL', 'FU'],
            ['BDL', 'BLU'],
            ['BRD', 'BDL'],
            ['BUR', 'BRD'],
            ['BLU', 'BUR'],
            ['BL', 'BU'],
            ['BD', 'BL'],
            ['BR', 'BD'],
            ['BU', 'BR'],
            ['UL', 'RU'],
            ['RU', 'DR'],
            ['DR', 'LD'],
            ['LD', 'UL'],
            ['U', 'R'],
            ['R', 'D'],
            ['D', 'L'],
            ['L', 'U']
        ],
        'M': [
            ['UB', 'FU'],
            ['BD', 'UB'],
            ['DF', 'BD'],
            ['FU', 'DF'],
            ['U', 'F'],
            ['B', 'U'],
            ['D', 'B'],
            ['F', 'D']
        ],
        'E': [
            ['LF', 'FR'],
            ['BL', 'LF'],
            ['RB', 'BL'],
            ['FR', 'RB'],
            ['L', 'F'],
            ['B', 'L'],
            ['R', 'B'],
            ['F', 'R']
        ],
        'S': [
            ['UL', 'RU'],
            ['RU', 'DR'],
            ['DR', 'LD'],
            ['LD', 'UL'],
            ['U', 'R'],
            ['R', 'D'],
            ['D', 'L'],
            ['L', 'U']
        ]
    }

    CUBIES = [
        'FLU', 'FU', 'FRU', 'FL', 'F', 'FR', 'DFL', 'DF', 'DFR',
        'BLU', 'BU', 'BRU', 'BL', 'B', 'BR', 'BDL', 'BD', 'BDR',
        'LU', 'L', 'DL',
        'RU', 'R', 'DR',
        'D', 'U'
    ]

    CUBE_MAP = [
        // UP
        ['BLU', 'U'], ['BU', 'U'], ['BRU', 'U'],
        ['UL', 'U' ], ['U', 'U' ], ['UR', 'U' ],
        ['FLU', 'U'], ['FU', 'U'], ['FRU', 'U'],
        // LEFT
        ['BLU', 'L'], ['UL', 'L'], ['FLU', 'L'],
        ['BL', 'L' ], ['L', 'L' ], ['FL', 'L' ],
        ['BLD', 'L'], ['DL', 'L'], ['FLD', 'L'],
        // FRONT
        ['FLU', 'F'], ['FU', 'F'], ['FRU', 'F'],
        ['FL', 'F' ], ['F', 'F' ], ['FR', 'F' ],
        ['FLD', 'F'], ['FD', 'F'], ['FRD', 'F'],
        // RIGHT
        ['FRU', 'R'], ['UR', 'R'], ['BRU', 'R'],
        ['FR', 'R' ], ['R', 'R' ], ['BR', 'R' ],
        ['FRD', 'R'], ['DR', 'R'], ['BRD', 'R'],
        // BACK
        ['BRU', 'B'], ['BU', 'B'], ['BLU', 'B'],
        ['BR', 'B' ], ['B', 'B' ], ['BL', 'B' ],
        ['BRD', 'B'], ['BD', 'B'], ['BLD', 'B'],
        // DOWN
        ['FLD', 'D'], ['FD', 'D'], ['FRD', 'D'],
        ['DL', 'D' ], ['D', 'D' ], ['DR', 'D' ],
        ['BLD', 'D'], ['BD', 'D'], ['BRD', 'D'],
    ]

    constructor () {
        this.__reset_cube()
        this.size = 3
    }

    __reset_cube() {
        this.cubies = {}
        for (var cubie of this.CUBIES) {
            // Sorting the key allows to access the dict in an unified manner
            cubie = cubie.split("").toSorted().join('')
            var dict = {}
            for (var face of cubie) {
                dict[face] = Cubie.init_facing_to_color(face)
                if (cubie.length == 3)
                    this.cubies[cubie] = new Corner(dict)
                else if (cubie.length == 2) 
                    this.cubies[cubie] = new Edge(dict)
                else
                    this.cubies[cubie] = new Center(dict)
            }
        }
    }

    // from_rendered_cube_old(cubies) {
    //     for (const i in this.CUBE_MAP) {
    //         var cube_map = this.CUBE_MAP[i]
    //         cube_map[0] = cube_map[0].split("").toSorted().join('')
    //         const pos = cube_map[0]
    //         const facing = cube_map[1]

    //         var posCubieName = ["F", "B", "L", "R", "D", "U"]
    //         var cubieName = [0, 0, 0, 0, 0, 0]
    //         for (const face of pos) { cubieName[posCubieName.indexOf(face)] = 1 }
    //         const cubie = cubies.filter((cubie) => JSON.stringify(cubie.name) == JSON.stringify(cubieName))[0]
    //         const edge = cubie.children.filter((edge) => edge.childNum == posCubieName.indexOf(facing))[0]
    //         this.cubies[pos].facings[facing] = edge.name[0].toUpperCase()
    //     }
    //     for (var [cubie, face] of this.CUBE_MAP) {
    //         cubie = cubie.split('').toSorted().join('')
    //     }
    // }

    from_rendered_cube(edges) {
        
        function round(value, step = 1.0) {
            var inv = 1.0 / step
            return Math.round(value * inv) / inv
        }

        function get_face(v3) {
            const face_mapx = {"-1.5": "L", "1.5": "R"}
            const face_mapy = {"-1.5": "D", "1.5": "U"}
            const face_mapz = {"-1.5": "B", "1.5": "F"}
            if (face_mapx[round(v3.x, 0.5)] != null) {return face_mapx[round(v3.x, 0.5)]}
            else if (face_mapy[round(v3.y, 0.5)] != null) {return face_mapy[round(v3.y, 0.5)]}
            else return face_mapz[round(v3.z, 0.5)]
        }

        function get_pos(v3) {
            var pos = ""
            const face_mapx = {"-1.5": "L", "1.5": "R", "-1": "L", "1": "R"}
            const face_mapy = {"-1.5": "D", "1.5": "U", "-1": "D", "1": "U"}
            const face_mapz = {"-1.5": "B", "1.5": "F", "-1": "B", "1": "F"}

            const px = face_mapx[round(v3.x, 0.5)]
            const py = face_mapy[round(v3.y, 0.5)]
            const pz = face_mapz[round(v3.z, 0.5)]

            if (px != null) {pos += px}
            if (py != null) {pos += py}
            if (pz != null) {pos += pz}

            return pos.split("").toSorted().join('')
        }

        var v3 = new THREE.Vector3()
        for (const edge of edges) {
            edge.getWorldPosition(v3)
            this.cubies[get_pos(v3)].facings[get_face(v3)] = edge.name[0].toUpperCase()
        }
    }

    verify_cube() {
        //https://puzzling.stackexchange.com/questions/53846/how-to-determine-whether-a-rubiks-cube-is-solvable

        // check if all center pices appear
        const centers_color = ["W", "O", "G", "R", "B", "Y"]
        for (const center of centers_color) {
            if (this.search_by_colors(center) == null) {
                return `Missing Center Piece ${center}`
            }
        }

        // standard cube
        const opposite_faces = {"B": "F", "F": "B", "R": "L", "L": "R", "U": "D", "D": "U"}
        const opposites = {"W": "Y", "B": "G", "R": "O"}
        for (const [face1, face2] of Object.entries(opposites)) {
            const f1 = this.search_by_colors(face1)
            const f2 = this.search_by_colors(face2)
            if (f1 != opposite_faces[f2]) {
                return `${face1} should be opposite of ${face2} in a standard cube`
            }
        }

        // check if all edges appear
        const edges_color = [["W", "O"], ["W", "B"], ["W", "G"], ["W", "R"],
        ["Y", "R"], ["Y", "B"], ["Y", "G"], ["Y", "O"],
        ["G", "O"], ["B", "O"], ["B", "R"], ["R", "G"],]
        for (const edge of edges_color) {
            if (this.search_by_colors(...edge) == null) {
                return `Missing Edge Piece ${edge[0]} ${edge[1]}`
            }
        }

        // check if all corners appear
        const corners_color = [["W", "R", "B"], ["W", "R", "G"], ["W", "G", "O"], ["W", "B", "O"],
        ["Y", "R", "B"], ["Y", "R", "G"], ["Y", "G", "O"], ["Y", "B", "O"]]
        for (const corner of corners_color) {
            if (this.search_by_colors(...corner) == null) {
                return `Missing Corner Piece ${corner[0]} ${corner[1]} ${corner[2]}`
            }
        }

        // corner rotation
        var rotation_sum = 0
        // corners = [ ["Corner", ["Anticlockwise", "No rotation", "Clockwise"]], ... ]
        const corners_rotation = [ ["FLU", ["L", "U", "F"]],
        ['FRU', ["F", "U", "R"]],
        ['DFL', ["F", "D", "L"]], 
        ['DFR', ["R", "D", "F"]], 
        ['BLU', ["B", "U", "L"]], 
        ['BRU', ["R", "U", "B"]], 
        ['BDL', ["L", "D", "B"]], 
        ['BDR', ["B", "D", "R"]]]
        for (const corner of corners_rotation) {
            const cubie = this.cubies[corner[0]]
            var val = -1
            for (const face of corner[1]) {
                if (["W", "Y"].includes(cubie.facings[face])) {rotation_sum += val}
                val++
            }
        }
        if (Math.abs(rotation_sum) % 3 != 0) {
            return "One corner rotated"
        }

        // Edge Parity
        var edge_parity = 0
        const edges = ['FU', 'FL', 'FR', 'DF', 'BU', 'BL', 'BR', 'BD', 'LU', 'DL', 'RU', 'DR']
        for (const edge of edges) {
            var piority_face = null
            for (const face of ["F", "B", "U", "D"]) {
                if (edge.includes(face)) {
                    piority_face = face;
                    break;
                }
            }
            if (["Y", "W"].includes(this.cubies[edge].facings[piority_face])  // Any white or yellow square.
            || (["R", "O"].includes(this.cubies[edge].facings[piority_face]) && !["RW", "RY", "OW", "OY"].includes(this.cubies[edge].colors().toSorted().join('')))// Any red or orange square not connected to a white or yellow square on the same edge piece.
            ) {
                edge_parity++;
            }
        }

        if (edge_parity % 2 != 0) {
            return "Edge parity condition not fufiled"
        }

        // Permutation parity
        // https://www.quora.com/Is-it-possible-to-determine-whether-a-Rubiks-Cube-is-solvable-just-by-looking-at-its-scrambled-state
        const corner_color = {"FLU": ['B', 'O', 'W'],
            "FRU": ['B', 'R', 'W'],
            "DFL": ['G', 'O', 'W'],
            "DFR": ['G', 'R', 'W'],
            "BLU": ['B', 'O', 'Y'],
            "BRU": ['B', 'R', 'Y'],
            "BDL": ['G', 'O', 'Y'],
            "BDR": ['G', 'R', 'Y']
        }
        const color_corner = {"BOW": "FLU",
            "BRW": "FRU",
            "GOW": "DFL",
            "GRW": "DFR",
            "BOY": "BLU",
            "BRY": "BRU",
            "GOY": "BDL",
            "GRY": "BDR"
        }
        var accounted_corners = {"FLU": 0,
        "FRU": 0,
        "DFL": 0,
        "DFR": 0,
        "BLU": 0,
        "BRU": 0,
        "BDL": 0,
        "BDR": 0
        }
        const edge_color = {"FU": ['B', 'W'],
            "FL": ['O', 'W'],
            "FR": ['R', 'W'],
            "DF": ['G', 'W'],
            "BU": ['B', 'Y'],
            "BL": ['O', 'Y'],
            "BR": ['R', 'Y'],
            "BD": ['G', 'Y'],
            "LU": ['B', 'O'],
            "DL": ['G', 'O'],
            "RU": ['B', 'R'],
            "DR": ['G', 'R']
        }
        const color_edge = {"BW": "FU",
            "OW": "FL",
            "RW": "FR",
            "GW": "DF",
            "BY": "BU",
            "OY": "BL",
            "RY": "BR",
            "GY": "BD",
            "BO": "LU",
            "GO": "DL",
            "BR": "RU",
            "GR": "DR"
        }
        var accounted_edges = {"FU": 0,
        "FL": 0,
        "FR": 0,
        "DF": 0,
        "BU": 0,
        "BL": 0,
        "BR": 0,
        "BD": 0,
        "LU": 0,
        "DL": 0,
        "RU": 0,
        "DR": 0
        }


        function countSwaps(position, cubies, count, parity_count, isCorner) {
            if (isCorner && accounted_corners[position] == 0) accounted_corners[position] = 1
            else if (isCorner) {
                for (const [key, value] of Object.entries(accounted_corners)) {
                    if (value == 0) return countSwaps(key, cubies, 0, parity_count + (count % 2 == 0), isCorner)
                }
                return parity_count + (count % 2 == 0)
            }

            if (!isCorner && accounted_edges[position] == 0) accounted_edges[position] = 1
            else if (!isCorner) {
                for (const [key, value] of Object.entries(accounted_edges)) {
                    if (value == 0) return countSwaps(key, cubies, 0, parity_count + (count % 2 == 0), isCorner)
                }
                return parity_count + (count % 2 == 0)
            }

            const curr_color = cubies[position].colors().toSorted()
            
            if (isCorner && curr_color.toString() != corner_color[position].toString()) {
                return countSwaps(color_corner[curr_color.join("")], cubies, count + 1, parity_count, isCorner)
            }
            else if (!isCorner && curr_color.toString() != edge_color[position].toString()) {
                return countSwaps(color_edge[curr_color.join("")], cubies, count + 1, parity_count, isCorner)
            }
            else {
                return countSwaps(position, cubies, count + 1, parity_count, isCorner)
            }
        }

        var corner_swaps = countSwaps("FLU", this.cubies, 0, 0, true)
        var edge_swaps = countSwaps("FU", this.cubies, 0, 0, false)

        if (corner_swaps % 2 != edge_swaps % 2) return "Permutation of cube not valid"

        return "Valid Cube"
    }

    from_naive_cube(cube) {
        for (const [i, color] of enumerate(cube)) {
            var cube_map = this.CUBE_MAP[i]
            cube_map[0] = cube_map[0].split("").toSorted().join('')
            this.cubies[cube_map[0]].facings[cube_map[1]] = color.toUpperCase()
        }
    }

    to_naive_cube() {
        var configuration = ''
        for (var [cubie, face] of this.CUBE_MAP) {
            cubie = cubie.split('').toSorted().join('')
            configuration += this.cubies[cubie].facings[face]
        }
        return configuration
    }

    move_changes(move) {
        var changes = this.MOVES[move.face()]
        function swap(item) {return [item[1], item[0]]}
        if (move.counterclockwise()) {changes = changes.map(swap)}
        return changes
    }

    move(move) {
        const changes = this.move_changes(move)
        var original_cubies = {}
        for (const [c_origin, c_dest] of changes) {
            var c_t_origin = c_origin.split('').toSorted().join('')

            var origin_cubie = this.cubies[c_t_origin]
            if (c_t_origin in original_cubies) origin_cubie = original_cubies[c_t_origin]

            const dest_cubie = this.cubies[c_dest.split('').toSorted().join('')]

            original_cubies[c_dest.split('').toSorted().join('')] = _.cloneDeep(dest_cubie)
            
            for (const [i, origin_facing] of enumerate(c_origin)) {
                dest_cubie.facings[c_dest[i]] = origin_cubie.facings[origin_facing]
            }
        }

        if (move.double()) this.move(new Move(move.face()))
    }

    search_by_colors(...args) {
        args = args.toSorted().join('').toUpperCase()
        for (const [key, cubie] of Object.entries(this.cubies)) {
            var cubie_colors = Object.values(cubie.facings).toSorted().join('').toUpperCase()
            if (args == cubie_colors) return key
        }
        return null
    }
}

export {Cubie, Cube}