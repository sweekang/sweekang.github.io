import { Move } from '/solver/beginner/move.js';

class BeginnerSolver {
    constructor (cube) {
        this.cube = cube;
    }

    move(move, solution) {
        solution.push(move);
        this.cube.move(new Move(move));
    }

    solution() {

        const cube = _.cloneDeep(this.cube);
        var explanation = [];

        var [solution, wc_explanation] = new WhiteCrossSolver(cube).solution();
        explanation.push(wc_explanation);

        const [wf_solution, wf_explanation] = new WhiteFaceSolver(cube).solution();
        solution = solution.concat(wf_solution);
        explanation.push(wf_explanation);
        explanation.push({"First layer complete, Flip cube over: ": ["Z2", ]});

        const [sl_solution, sl_explanation] = new SecondLayerSolver(cube).solution();
        solution = solution.concat(sl_solution);
        explanation.push(sl_explanation);

        const [yc_solution, yc_explanation] = new YellowCrossSolver(cube).solution();
        solution = solution.concat(yc_solution);
        explanation.push(yc_explanation);

        const [yf_solution, yf_explanation] = new YellowFaceSolver(cube).solution();
        solution = solution.concat(yf_solution);
        explanation.push(yf_explanation);

        return [solution, explanation];
    }
}

class WhiteCrossSolver extends BeginnerSolver {

    ORIENT_WHITE = {
        "F": "X",
        "D": "X2",
        "B": "X'",
        "L": "Z",
        "R": "Z'"
    };

    ORIENT_FACING = {
        "RU": ["R'"],
        "DR": ["D'"],
        "LU": ["L"],
        "DL": ["D"],
        "BU": ["B2", "D2"],
        "BR": ["U'", "R2", "U"],
        "BL": ["U", "L2", "U'"],
        "BD": ["D2"]
    };

    ALGORITHMS = {
        //"WC"
        "LF": ["F"],
        "DF": ["F2"],
        "RF": ["F'"],

        "FU": ["F", "U'", "R", "U"],
        "FD": ["F'", "U'", "R", "U"],

        "FL": ["U", "L'", "U'"],
        "FR": ["U'", "R", "U"]
    };

    edge_is_placed(face) {
        const edge = face + "U";

        const edge_color = this.cube.cubies[edge].facings[face];
        const face_color = this.cube.cubies[face].facings[face];

        return face_color == edge_color && this.cube.cubies[edge].facings["U"] == "W";
    }

    unsolved_faces() {
        const faces = ['F', 'L', 'B', 'R'];
        return faces.filter((face) => !this.edge_is_placed(face));
    }

    solution() {
        var solution = [];
        var explanation = {};

        // orient cube to place white center on top
        const white_position = this.cube.search_by_colors('W');
        if (white_position != "U") {
            const m = this.ORIENT_WHITE[white_position];
            this.move(m, solution);
            explanation["Orient white center sticker to top: "] = [m, ];
        } else { explanation["Orient white center sticker to top: "] = ["Already on top", ]; }

        var unsolved_faces = this.unsolved_faces();
        while (unsolved_faces.length != 0) {
            var white_c_explanation = {}

            const to_solve = unsolved_faces[0];
            const orient_face = {"R": "Y", "L": "Y'", "B": "Y2"};
            var m;
            // orient so that face is in front
            if (to_solve != "F") {
                m = orient_face[to_solve];
                this.move(m, solution);
            }
            // get color of said face
            const color = this.cube.cubies["F"].facings["F"];
            
            if ( m ) {white_c_explanation[`Orient ${color} center sticker to front: `] = [m, ];}
            
            // align piece with color and white to be next to center if possible
            var cubie_position = this.cube.search_by_colors('W', color);
            var orig_cubie = this.cube.cubies[cubie_position];
            var white_facing = orig_cubie.color_facing('W');
            var color_facing = orig_cubie.color_facing(color);

            if (white_facing != "F" && color_facing != "F") {
                const key = [white_facing, color_facing].toSorted().join('')
                const orient_solution = this.ORIENT_FACING[key];
                for (const m of orient_solution) { this.cube.move(new Move(m));}
                solution = solution.concat(orient_solution);
                white_c_explanation[`Orient W ${color} piece to front: `] = orient_solution;
            }

            cubie_position = this.cube.search_by_colors('W', color);
            orig_cubie = this.cube.cubies[cubie_position];
            white_facing = orig_cubie.color_facing('W');
            color_facing = orig_cubie.color_facing(color);
            
            const step_solution = this.ALGORITHMS[[white_facing, color_facing].join('')];
            if (step_solution != null)  {
                for (const m of step_solution) { this.cube.move(new Move(m)); }
                solution = solution.concat(step_solution);
                white_c_explanation[`Place W ${color} piece: `] = step_solution;
            }

            explanation[`Solve for W ${color}: `] = white_c_explanation;
            unsolved_faces = this.unsolved_faces();
        }

        return [solution, explanation];
    }
}

class WhiteFaceSolver extends BeginnerSolver {
    
    ORIENT = {
        'DFR': [],
        'DFL': ["D"],
        'BDL': ["D2"],
        'BDR': ["D'"],
        'FRU': ["R'", "D'", "R", "D"],
        'FLU': ["L", "D", "L'"],
        'BLU': ["L'", "D'", "L", "D'"],
        'BRU': ["R", "D'", "R'", "D'"]
    }

    ALGO = {
        //WF
        "RF": ["R'", "D'", "R"],
        "FD": ["F", "D", "F'"],
        "DR": ["R2", "D'", "R2", "D", "R2"],
        "RD": ["F", "D", "F'"]
    }

    solution() {
        var solution = [];
        var explanation = {};
        // There are 4 down-corners

        for (let i = 0; i < 4; i++) {
            // find corner piece for front and right
            var fru_explanation = {};

            const front_color = this.cube.cubies['F'].facings['F'];
            const right_color = this.cube.cubies['R'].facings['R'];

            var goal_cubie = this.cube.search_by_colors('W', front_color, right_color);
            var goal_cubie_obj = this.cube.cubies[goal_cubie];
            var wFace = goal_cubie_obj.color_facing('W');
            var fFace = goal_cubie_obj.color_facing(front_color);
           
            if (goal_cubie == "FRU" && wFace == "U" && fFace == "F") {
                fru_explanation["In FRU already"] = "";
            }
            else {
                // orient piece to front bottom
                const orient_steps = this.ORIENT[goal_cubie];
                for (const move of orient_steps) { this.move(move, solution); }
                fru_explanation[`Orient W ${front_color} ${right_color} from ${goal_cubie} to FBD: `] = orient_steps;

                // Place on top
                goal_cubie = this.cube.search_by_colors('W', front_color, right_color);
                goal_cubie_obj = this.cube.cubies[goal_cubie];
                const step_solution = this.ALGO[goal_cubie_obj.color_facing('W') + goal_cubie_obj.color_facing(front_color)];
                for (const move of step_solution) { this.move(move, solution); }
                fru_explanation[`Place W ${front_color} ${right_color}: `] = step_solution;
            }
            

            // Cubie is placed, move to next
            if (i != 3) {
                this.move('Y', solution);
                fru_explanation["Move on to next face: "] = ["Y", ];
            }
            explanation[`Solve for W ${front_color} ${right_color}: `] = fru_explanation;
            
        }

        return [solution, explanation];
    }
}

class SecondLayerSolver extends BeginnerSolver {

    ORIENT = {"BR": "Y", "BL": "Y2", "FL": "Y'"};
    REVERSE = {"BR": "Y'", "BL": "Y2", "FL": "Y"};
    PLACE = {"LU": "U'", "RU": "U", "BU": "U2"};

    right_algo(solution) { for (const m of ["U", "R", "U'", "R'", "U'", "F'", "U", "F"]) {this.move(m, solution);} }

    is_solved() {
        // Check if edges FL, FR, BL and BR are correctly placed and oriented
        const front_color = this.cube.cubies['F'].facings['F']
        const back_color = this.cube.cubies['B'].facings['B']
        const left_color = this.cube.cubies['L'].facings['L']
        const right_color = this.cube.cubies['R'].facings['R']

        var success = this.cube.cubies['FL'].facings['F'] == front_color && this.cube.cubies['FL'].facings['L'] == left_color
        success = success && this.cube.cubies['FR'].facings['F'] == front_color && this.cube.cubies['FR'].facings['R'] == right_color
        success = success && this.cube.cubies['BL'].facings['B'] == back_color && this.cube.cubies['BL'].facings['L'] == left_color
        success = success && this.cube.cubies['BR'].facings['B'] == back_color && this.cube.cubies['BR'].facings['R'] == right_color

        return success
    }

    solution() {
        var solution = [];
        var explanation = {};
        // flip to bottom now that white is solved
        this.move('Z2', solution);

        for (let i = 0; i < 4; i++) {
            var fr_explanation = {};
            // find side piece for front and right
            const front_color = this.cube.cubies['F'].facings['F'];
            const right_color = this.cube.cubies['R'].facings['R'];

            var goal_cubie = this.cube.search_by_colors(front_color, right_color);
            var goal_cubie_obj = this.cube.cubies[goal_cubie];
            var face = goal_cubie_obj.color_facing(front_color);

            if (goal_cubie == "FR" && face == "F") {
                fr_explanation["Already Solved"] = [""];
            }
            else {
                if (goal_cubie == "FR") {
                    this.right_algo(solution);
                    fr_explanation[`Pop ${front_color} ${right_color} from FR to U (right algo): `] = ["U", "R", "U'", "R'", "U'", "F'", "U", "F"];
                } //pop it out
                else if (!goal_cubie.includes("U")) { // not in top layer
                    fr_explanation[`Orient so that ${front_color} ${right_color} is in FR: `] = [this.ORIENT[goal_cubie], ];
                    this.move(this.ORIENT[goal_cubie], solution);
                    fr_explanation[`Pop ${front_color} ${right_color} from FR to U (right algo): `] = ["U", "R", "U'", "R'", "U'", "F'", "U", "F"];
                    this.right_algo(solution); // pop cube out
                    fr_explanation[`Orient cube back: `] = [this.REVERSE[goal_cubie], ];
                    this.move(this.REVERSE[goal_cubie], solution); // orient back to front
                }
                goal_cubie = this.cube.search_by_colors(front_color, right_color);
                if (goal_cubie != "FU") { // in top layer, but not at front
                    fr_explanation[`Move ${front_color} ${right_color} to FU: `] = [this.PLACE[goal_cubie], ];
                    this.move(this.PLACE[goal_cubie], solution);
                }
             
                this.right_algo(solution); // place cube
                fr_explanation[`Place ${front_color} ${right_color} from FU to FR (right algo): `] = ["U", "R", "U'", "R'", "U'", "F'", "U", "F"];
            }

            face = this.cube.cubies["FR"].color_facing(front_color);
            if (face != "F") {i--;}
            if (i != 3 && face == "F") {
                this.move("Y", solution);
                fr_explanation[`Move on to next face: `] = ["Y", ];
            }
            for (let j = 0; j < 4; j++) {
                if (!explanation[`Solve for ${front_color} ${right_color}: ${" ".repeat(j)}`]) {
                    explanation[`Solve for ${front_color} ${right_color}: ${" ".repeat(j)}`] = fr_explanation;
                    break;
                }
            }
        }

        return [solution, explanation];
    }
}

class YellowCrossSolver extends BeginnerSolver {
    apply_algorithm(solution) {
        for (const move of ["F", "R", "U", "R'", "U'", "F'"]) {this.move(move, solution);}
    }

    solution() {
        var solution = [];
        var explanation = {};

        // Apply F R U R' U' F' once, twice or thrice
        var up_yellows = ['FU', 'RU', 'LU', 'BU'];
        // find yellows facing up
        up_yellows = up_yellows.filter((edge) => this.cube.cubies[edge].color_facing('Y') == 'U');

        if (up_yellows.length == 0) {
            // no yellow on top, apply algo
            this.apply_algorithm(solution);
            this.move("U2", solution);
            this.apply_algorithm(solution);
            this.apply_algorithm(solution);
            explanation["No yellow on top, apply algo + U2 + algo*2: "] = ["F", "R", "U", "R'", "U'", "F'", "U2", "F", "R", "U", "R'", "U'", "F'", "F", "R", "U", "R'", "U'", "F'"];
        }

        else if (up_yellows.length == 2) {
            // If in L position
            if (!(up_yellows.includes('FU') && up_yellows.includes('BU')) && !(up_yellows.includes('RU') && up_yellows.includes('LU'))) {
                // Rotate until L is at FU, RU
                var cnt = 0;
                while (!(this.cube.cubies['FU'].color_facing('Y') == 'U' && this.cube.cubies['RU'].color_facing('Y') == 'U')) {
                    this.move("Y", solution);
                    cnt++;
                }
                // Moves yellow to face up -- creates yellow "L"
                this.apply_algorithm(solution);
                var l_position = {};
                l_position["Orient cube where ther is no yellow L at FU, RU: "] = new Array(cnt).fill("Y");
                l_position["Create yellow L (apply algo): "] = ["F", "R", "U", "R'", "U'", "F'"];
                explanation["Make yellow L: "] = l_position;
            }
            var line_explanation = {};
            var cnt = 0;
            // Rotate until line is at RU, LU
            while (!(this.cube.cubies['RU'].color_facing('Y') == 'U' && this.cube.cubies['LU'].color_facing('Y') == 'U')){
                this.move("Y", solution);
                cnt++;
            }
            if (cnt == 0) {line_explanation["Orient so there is yellow line at RU LU: "] = ["yellow line already at RU LU"];}
            else {line_explanation["Orient so there is yellow line at RU LU: "] = new Array(cnt).fill("Y");}
            // Make cross
            explanation["Solve yellow cross (apply algo): "] = ["F", "R", "U", "R'", "U'", "F'"];
            this.apply_algorithm(solution)
        }
        else {
            explanation["Yellow cross already solved"] = [""];
        }

        return [solution, explanation];
    }
}

class YellowFaceSolver extends BeginnerSolver {
    apply_edges_algorithm(solution) { // swap FU, LU
        for (const move of ["R", "U", "R'", "U", "R", "U2", "R'", "U"]) {this.move(move, solution);}
    }

    apply_corner_place_algorithm(solution) {
        for (const move of ["U", "R", "U'", "L'", "U", "R'", "U'", "L"]) {this.move(move, solution)}
    }

    apply_corner_orient_algorithm(solution) {
        for (const move of ["R'", "D'", "R", "D"]) {this.move(move, solution)}
    }

    edge_is_placed(edge) {
        const face = edge.replace('U', '');

        const edge_color = this.cube.cubies[edge].facings[face];
        const face_color = this.cube.cubies[face].facings[face];

        return face_color == edge_color;
    }

    unplaced_edges() {
        const placed_edges = ['FU', 'BU', 'LU', 'RU'];
        return placed_edges.filter((edge) => !this.edge_is_placed(edge));
    }

    corner_is_placed(corner) { // is placed if the color of cubie's front and right is in cubie (does not need to be oriented)
        const cubie_corner = this.cube.cubies[corner]
        const related_edges = cubie_corner.faces().join('').replace('U', '')
        for (const edge of related_edges) {
            if (!cubie_corner.colors().includes(this.cube.cubies[edge+'U'].facings[edge])) {return false}
        }

        return true
    }

    placed_corners() {
        const placed_corners = ['FRU', 'FLU', 'BRU', 'BLU'];
        return placed_corners.filter((corner) => this.corner_is_placed(corner));
    }

    solution() {
        var solution = [];
        var explanation = {};
        // Place edges
        var front_color = this.cube.cubies['F'].facings['F'];
        var goal_cubie = this.cube.search_by_colors(front_color, "Y");

        if (this.unplaced_edges().length == 0) {explanation["Place Yellow edges: "] = ["Yellow edges in place already"];}

        else {
            var edge_explanation = {};
            if (goal_cubie == "FU") {edge_explanation[`Orient yellow ${front_color} to front: `] = ["Already in front"];}
            else {
                const orient = {"LU": "U'", "RU": "U", "BU": "U2"};
                this.move(orient[goal_cubie], solution);
                edge_explanation[`Orient yellow ${front_color} to front: `] = [orient[goal_cubie], ];
            }

            const unplaced_edges = this.unplaced_edges();
            if (unplaced_edges.length == 3) {
                var edge3_explanation = {};
                
                const back_color = this.cube.cubies["B"].facings["B"];
                const goal_cubie = this.cube.search_by_colors(back_color, "Y");
                if (goal_cubie == "LU") {
                    this.move("Y'", solution); // swap L and B
                    this.apply_edges_algorithm(solution);
                    edge3_explanation["Swap LU and BU as LU has BF (apply algo): "] = ["Y'", "R", "U", "R'", "U", "R", "U2", "R'", "U"];
                }
                else {
                    this.move("Y2", solution); // swap R and B
                    this.apply_edges_algorithm(solution);
                    edge3_explanation["Swap RU and BU as RU has BF (apply algo): "] = ["Y2", "R", "U", "R'", "U", "R", "U2", "R'", "U"];
                }
                this.move("U", solution);
                this.apply_edges_algorithm(solution); // swap L and R
                this.move("Y2", solution);
                this.apply_edges_algorithm(solution);
                edge3_explanation["Swap LU and RU (apply algo * 2): "] = ["U", "R", "U", "R'", "U", "R", "U2", "R'", "U", "Y2", "R", "U", "R'", "U", "R", "U2", "R'", "U"];

                edge_explanation["3 yellow edges out of place: "] = edge3_explanation;
            }
            else if (unplaced_edges.length == 2) {
                if (unplaced_edges.includes("BU")) { // adjacent edges out of place, since front in place
                    if (unplaced_edges.includes("LU")) {
                        edge_explanation["back and left yellow edges out of place (apply algo): "] = ["Y'", "R", "U", "R'", "U", "R", "U2", "R'", "U"];
                        this.move("Y'", solution); // make left the front
                        this.apply_edges_algorithm(solution);
                    }
                    else {
                        edge_explanation["back and right yellow edges out of place (apply algo): "] = ["Y2", "R", "U", "R'", "U", "R", "U2", "R'", "U"];
                        this.move("Y2", solution); // make back the front
                        this.apply_edges_algorithm(solution);
                    }
                }
                else { // algo for opposite edges
                    edge_explanation["opposite yellow edges (L&R) out of place (apply algo *2): "] = ["U", "R", "U", "R'", "U", "R", "U2", "R'", "U", "Y2", "R", "U", "R'", "U", "R", "U2", "R'", "U"];
                    this.move("U", solution);
                    this.apply_edges_algorithm(solution);
                    this.move("Y2", solution);
                    this.apply_edges_algorithm(solution);
                }
            }
            explanation["Place Yellow edges: "] = edge_explanation;
        }

        var corner_explanation = {};
        var place_corner_explanation = {};
        var i = 0;
        // Place corner in their place
        while (true) {
            const placed_corners = this.placed_corners();
            if (placed_corners.length == 4) {break;}
            // If only 1 corner is well placed, place it at FRU and perform algorithm once or twice
            else if (placed_corners.length == 1) {
                var cnt = 0;
                while (this.placed_corners()[0] != 'FRU') {
                    cnt++;
                    this.move("U", solution);
                }
                for (let j = 0; j < 4; j++) {
                    if (cnt != 0) {
                        place_corner_explanation[`Rotate upper layer until corner is placed at FRU #${i}: `] = new Array(cnt).fill("U");
                    }
                    place_corner_explanation[`Apply algo #${i}: `] = ["U", "R", "U'", "L'", "U", "R'", "U'", "L"];
                }
               
                this.apply_corner_place_algorithm(solution);

            }
            // If no placed corners, perform algorithm and 1 corner will be placed
            else {
                place_corner_explanation["No corners placed, place one by applying algo: "] = ["U", "R", "U'", "L'", "U", "R'", "U'", "L"];
                this.apply_corner_place_algorithm(solution);
            }
            i++;
        }
        if (!place_corner_explanation) {corner_explanation["Place corners: "] = ["Corners already placed", ];}
        else {corner_explanation["Place corners: "] = place_corner_explanation;}

        // Orient corners
        var orient_explanation = {};
        for (let i = 0; i < 4; i++) {
            // Get corner at FRU
            const corner = this.cube.cubies['FRU'];
            var cnt = 1;
            const cnt_words = {1: "once", 2: "twice", 3: "thrice", 4: "four times"}
            while (corner.facings['U'] != 'Y') {
                // Apply corner orientation algorithm
                orient_explanation[`Orient corner #${i} (apply algo ${cnt_words[cnt]}): `] = ["R'", "D'", "R", "D"];
                this.apply_corner_orient_algorithm(solution);
                cnt++;
            }
            if (i != 3) {
                orient_explanation[`Move on to next corner #${i}: `] = ["U", ]
                this.move("U", solution);
            }
        }
        corner_explanation["Orient corners: "] = orient_explanation;
        explanation["Solve corners: "] = corner_explanation;

        // Finally, align the top layer
        var front_color = this.cube.cubies['F'].facings['F'];
        var goal_cubie = this.cube.search_by_colors(front_color, "Y");
        if ( goal_cubie != "FU" ) {
            const orient_last_layer = {"RU": "U", "LU": "U'", "BU": "U2"};
            this.move(orient_last_layer[goal_cubie], solution);
            explanation["Orient last layer: "] = [orient_last_layer[goal_cubie], ];
        }
        
        return [solution, explanation];
    }
}

export { BeginnerSolver }