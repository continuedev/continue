"use strict";
module.exports = proto_target;

proto_target.private = true;

var protobuf = require("../..");

var Namespace  = protobuf.Namespace,
    Enum       = protobuf.Enum,
    Type       = protobuf.Type,
    Field      = protobuf.Field,
    OneOf      = protobuf.OneOf,
    Service    = protobuf.Service,
    Method     = protobuf.Method,
    types      = protobuf.types,
    util       = protobuf.util;

function underScore(str) {
    return str.substring(0,1)
         + str.substring(1)
               .replace(/([A-Z])(?=[a-z]|$)/g, function($0, $1) { return "_" + $1.toLowerCase(); });
}

var out = [];
var indent = 0;
var first = false;
var syntax = 3;

function proto_target(root, options, callback) {
    if (options) {
        switch (options.syntax) {
            case undefined:
            case "proto3":
            case "3":
                syntax = 3;
                break;
            case "proto2":
            case "2":
                syntax = 2;
                break;
            default:
                return callback(Error("invalid syntax: " + options.syntax));
        }
    }
    indent = 0;
    first = false;
    try {
        buildRoot(root);
        return callback(null, out.join("\n"));
    } catch (err) {
        return callback(err);
    } finally {
        out = [];
        syntax = 3;
    }
}

function push(line) {
    if (line === "")
        out.push("");
    else {
        var ind = "";
        for (var i = 0; i < indent; ++i)
            ind += "    ";
        out.push(ind + line);
    }
}

function escape(str) {
    return str.replace(/[\\"']/g, "\\$&")
              .replace(/\r/g, "\\r")
              .replace(/\n/g, "\\n")
              .replace(/\u0000/g, "\\0"); // eslint-disable-line no-control-regex
}

function value(v) {
    switch (typeof v) {
        case "boolean":
            return v ? "true" : "false";
        case "number":
            return v.toString();
        default:
            return "\"" + escape(String(v)) + "\"";
    }
}

function buildRoot(root) {
    root.resolveAll();
    var pkg = [];
    var ptr = root;
    var repeat = true;
    do {
        var nested = ptr.nestedArray;
        if (nested.length === 1 && nested[0] instanceof Namespace && !(nested[0] instanceof Type || nested[0] instanceof Service)) {
            ptr = nested[0];
            if (ptr !== root)
                pkg.push(ptr.name);
        } else
            repeat = false;
    } while (repeat);
    out.push("syntax = \"proto" + syntax + "\";");
    if (pkg.length)
        out.push("", "package " + pkg.join(".") + ";");

    buildOptions(ptr);
    ptr.nestedArray.forEach(build);
}

function build(object) {
    if (object instanceof Enum)
        buildEnum(object);
    else if (object instanceof Type)
        buildType(object);
    else if (object instanceof Field)
        buildField(object);
    else if (object instanceof OneOf)
        buildOneOf(object);
    else if (object instanceof Service)
        buildService(object);
    else if (object instanceof Method)
        buildMethod(object);
    else
        buildNamespace(object);
}

function buildNamespace(namespace) { // just a namespace, not a type etc.
    push("");
    push("message " + namespace.name + " {");
    ++indent;
    buildOptions(namespace);
    consolidateExtends(namespace.nestedArray).remaining.forEach(build);
    --indent;
    push("}");
}

function buildEnum(enm) {
    push("");
    push("enum " + enm.name + " {");
    buildOptions(enm);
    ++indent; first = true;
    Object.keys(enm.values).forEach(function(name) {
        var val = enm.values[name];
        if (first) {
            push("");
            first = false;
        }
        push(name + " = " + val + ";");
    });
    --indent; first = false;
    push("}");
}

function buildRanges(keyword, ranges) {
    if (ranges && ranges.length) {
        var parts = [];
        ranges.forEach(function(range) {
            if (typeof range === "string")
                parts.push("\"" + escape(range) + "\"");
            else if (range[0] === range[1])
                parts.push(range[0]);
            else
                parts.push(range[0] + " to " + (range[1] === 0x1FFFFFFF ? "max" : range[1]));
        });
        push("");
        push(keyword + " " + parts.join(", ") + ";");
    }
}

function buildType(type) {
    if (type.group)
        return; // built with the sister-field
    push("");
    push("message " + type.name + " {");
    ++indent;
    buildOptions(type);
    type.oneofsArray.forEach(build);
    first = true;
    type.fieldsArray.forEach(build);
    consolidateExtends(type.nestedArray).remaining.forEach(build);
    buildRanges("extensions", type.extensions);
    buildRanges("reserved", type.reserved);
    --indent;
    push("}");
}

function buildField(field, passExtend) {
    if (field.partOf || field.declaringField || field.extend !== undefined && !passExtend)
        return;
    if (first) {
        first = false;
        push("");
    }
    if (field.resolvedType && field.resolvedType.group) {
        buildGroup(field);
        return;
    }
    var sb = [];
    if (field.map)
        sb.push("map<" + field.keyType + ", " + field.type + ">");
    else if (field.repeated)
        sb.push("repeated", field.type);
    else if (syntax === 2 || field.parent.group)
        sb.push(field.required ? "required" : "optional", field.type);
    else
        sb.push(field.type);
    sb.push(underScore(field.name), "=", field.id);
    var opts = buildFieldOptions(field);
    if (opts)
        sb.push(opts);
    push(sb.join(" ") + ";");
}

function buildGroup(field) {
    push(field.rule + " group " + field.resolvedType.name + " = " + field.id + " {");
    ++indent;
    buildOptions(field.resolvedType);
    first = true;
    field.resolvedType.fieldsArray.forEach(function(field) {
        buildField(field);
    });
    --indent;
    push("}");
}

function buildFieldOptions(field) {
    var keys;
    if (!field.options || !(keys = Object.keys(field.options)).length)
        return null;
    var sb = [];
    keys.forEach(function(key) {
        var val = field.options[key];
        var wireType = types.packed[field.resolvedType instanceof Enum ? "int32" : field.type];
        switch (key) {
            case "packed":
                val = Boolean(val);
                // skip when not packable or syntax default
                if (wireType === undefined || syntax === 3 === val)
                    return;
                break;
            case "default":
                if (syntax === 3)
                    return;
                // skip default (resolved) default values
                if (field.long && !util.longNeq(field.defaultValue, types.defaults[field.type]) || !field.long && field.defaultValue === types.defaults[field.type])
                    return;
                // enum defaults specified as strings are type references and not enclosed in quotes
                if (field.resolvedType instanceof Enum)
                    break;
                // otherwise fallthrough
            default:
                val = value(val);
                break;
        }
        sb.push(key + "=" + val);
    });
    return sb.length
        ? "[" + sb.join(", ") + "]"
        : null;
}

function consolidateExtends(nested) {
    var ext = {};
    nested = nested.filter(function(obj) {
        if (!(obj instanceof Field) || obj.extend === undefined)
            return true;
        (ext[obj.extend] || (ext[obj.extend] = [])).push(obj);
        return false;
    });
    Object.keys(ext).forEach(function(extend) {
        push("");
        push("extend " + extend + " {");
        ++indent; first = true;
        ext[extend].forEach(function(field) {
            buildField(field, true);
        });
        --indent;
        push("}");
    });
    return {
        remaining: nested
    };
}

function buildOneOf(oneof) {
    push("");
    push("oneof " + underScore(oneof.name) + " {");
    ++indent; first = true;
    oneof.oneof.forEach(function(fieldName) {
        var field = oneof.parent.get(fieldName);
        if (first) {
            first = false;
            push("");
        }
        var opts = buildFieldOptions(field);
        push(field.type + " " + underScore(field.name) + " = " + field.id + (opts ? " " + opts : "") + ";");
    });
    --indent;
    push("}");
}

function buildService(service) {
    push("service " + service.name + " {");
    ++indent;
    service.methodsArray.forEach(build);
    consolidateExtends(service.nestedArray).remaining.forEach(build);
    --indent;
    push("}");
}

function buildMethod(method) {
    push(method.type + " " + method.name + " (" + (method.requestStream ? "stream " : "") + method.requestType + ") returns (" + (method.responseStream ? "stream " : "") + method.responseType + ");");
}

function buildOptions(object) {
    if (!object.options)
        return;
    first = true;
    Object.keys(object.options).forEach(function(key) {
        if (first) {
            first = false;
            push("");
        }
        var val = object.options[key];
        push("option " + key + " = " + JSON.stringify(val) + ";");
    });
}
