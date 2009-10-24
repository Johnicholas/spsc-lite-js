var node = function(exp, contraction) {
	return {
		exp: exp, 
		contraction: contraction,
		children: [],
		ancestors: function () {
			if (this.parent) {
				return [this.parent].concat(this.parent.ancestors());
			} else {
				return [];
			}
		},
		leaves: function () {
			var ls = [];
			if (this.children.length > 0) {
				for (var i = 0; i< this.children.length; i++) {
					ls.push(this.children[i].leaves());
				}
				return Array.prototype.concat.apply([], ls);
			} else {
				return [this];
			}
		},
		is_processed: function () {
			switch (this.exp.kind) {
			case 'Variable':
				return true;
			case 'Constructor':
				return this.exp.args.length == 0;
			case 'FCall':
			case 'GCall':
				var ancs = this.ancestors();
				for (var i = 0; i < ancs.length; i ++) {
					if (ancs[i].exp.kind == this.exp.kind && sll_algebra.equiv(this.exp, ancs[i].exp)) {
						return true;
					}
				}
				return false;
			default:
				return false;
			}
		},
		toString: function(indent) {
			var ind = indent || '';
			var chs = [];
			for (var i = 0; i < this.children.length; i++) {
				chs.push(this.children[i].toString(ind + '    '));
			}
			return [ind + '|__' + this.exp.toString()].concat(chs).join('\n ');
		}
	};
};

var tree = function(exp) {
	return {
		root: node(exp, null),
		// tc = [exp, contraction]*
		add_children: function(n, tc) {
			for (var i = 0; i < tc.length; i++) {
				var child_node = node(tc[i][0], tc[i][1]);
				child_node.parent = n;
				n.children.push(child_node);
			}
			return this;
		},
		leaves: function() {
			return this.root.leaves();
		},
		get_unprocessed_leaf: function() {
			var all_leaves = this.leaves();
			for (var i = 0; i < all_leaves.length; i++) {
				if (!all_leaves[i].is_processed()) {
					return all_leaves[i];
				}
			}
			return null;
		},
		replace: function(n, exp) {
			if (n == this.root) {
				this.root = node(exp, null);
			} else {
				var new_node = node(exp, node.contraction);
				new_node.parent = n.parent;
				for (var i = 0; i < n.parent.children.length; i++) {
					if (n.parent.children[i] == n) {
						n.parent.children[i] = new_node;
					}
				}
			}
		},
		toString: function() {
			return this.root.toString();
		}
	};
};

var base_supercompiler = function(program) {
	return {
		program: program,
		
		drive: function(e) {
			switch (e.kind) {
			case 'Constructor':
				var res = [];
				for (var i = 0; i < e.args.length; i++) {
					res.push([e.args[i], null]);
				}
				return res;
			case 'FCall':
				var f_rule = program.f[e.name];
				var map = {};
				for (var i = 0; i < e.args.length; i++) {
					map[f_rule.args[i].name] = e.args[i];
				}
				return [[sll_algebra.apply_subst(f_rule.exp, map), null]];
			case 'GCall':
				var arg1 = e.args[0];
				switch (arg1.kind) {
				case 'Constructor':
					var g_rule = program.g[e.name + '_' + arg1.name];
					var map = {};
					for (var i = 0; i < arg1.args.length; i++) {
						map[g_rule.pattern.args[i].name] = arg1.args[i];
					}
					for (var i = 0; i < g_rule.args.length; i++) {
						map[g_rule.args[i].name] = e.args[i + 1];
					}
					return [[sll_algebra.apply_subst(g_rule.exp, map), null]];
				case 'Variable':
					var res = [];
					var g_rules = this.program.gs[e.name];
					for (var i = 0; i < g_rules.length; i ++) {
						var fp = this.fresh_pattern(g_rules[i].pattern);
						var fc = sll_lang.constructor(fp.name, fp.args);
						var map = {};
						map[arg1.name] = fc;
						var x = this.drive(sll_algebra.apply_subst(e, map));
						res.push([x[0][0], [arg1, fp]]);
					}
					return res;
				default:
					var inner_drs = this.drive(arg1);
					var res = [];
					for (var i = 0; i < inner_drs.length; i++) {
						var inner_dr = inner_drs[i];
						var gc = sll_lang.gcall(e.name, [inner_dr[0]].concat(e.args.slice(1)));
						res.push([gc, inner_dr[1]]);
					}
					return res;
				}
			case 'Let':
				var res = [[e.exp, null]];
				for (var i = 0; i < e.bindings.length; i++) {
					res.push([e.bindings[i][1], null]);
				}
				return res;
			}
		},
		
		fresh_pattern: function(p) {
			var new_args = [];
			for (var i = 0; i < p.args.length; i ++) {
				new_args.push(sll_algebra.fresh_var());
			}
			return sll_lang.pattern(p.name, new_args);
		},
		
		build_tree: function(exp) {
			var t = tree(exp);
			console.log(t.toString());
			while (t.get_unprocessed_leaf()) {
				//console.log(t);
				var b = t.get_unprocessed_leaf();
				switch (b.exp.kind) {
				case 'FCall':
				case 'GCall':
					var ancs = b.ancestors();
					var a = null;
					for (var i = 0; i < ancs.length; i++) {
						var _a = ancs[i];
						if (_a.exp.kind == b.exp.kind && sll_algebra.instance_of(_a.exp, b.exp)) {
							a = _a;
							break;
						}
					}
					if (a) {
						var map = sll_algebra.match_against(a.exp, b.exp);
						var bindings = [];
						for (var n in map) {
							bindings.push([n, map[n]]);
						}
						var l = sll_lang.let(a.exp, bindings);
						t.replace(b, l);
					} else {
						t.add_children(b, this.drive(b.exp));
					}
					break;
				default:
					t.add_children(b, this.drive(b.exp));
				}
				console.log(t.toString());
			}
		}
	};
};

var generator = function(tree) {
	return {
		
	};
};
