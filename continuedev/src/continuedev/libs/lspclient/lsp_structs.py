def to_type(o, new_type):
    '''
    Helper funciton that receives an object or a dict and convert it to a new given type.

    :param object|dict o: The object to convert
    :param Type new_type: The type to convert to.
    '''
    if new_type == type(o):
        return o
    else:
        return new_type(**o)


class Position(object):
    def __init__(self, line, character):
        """
        Constructs a new Position instance.

        :param int line: Line position in a document (zero-based).
        :param int character: Character offset on a line in a document (zero-based).
        """
        self.line = line
        self.character = character


class Range(object):
    def __init__(self, start, end):
        """
        Constructs a new Range instance.

        :param Position start: The range's start position.
        :param Position end: The range's end position.
        """
        self.start = to_type(start, Position)
        self.end = to_type(end, Position)


class Location(object):
    """
    Represents a location inside a resource, such as a line inside a text file.
    """
    def __init__(self, uri, range):
        """
        Constructs a new Range instance.

        :param str uri: Resource file.
        :param Range range: The range inside the file
        """
        self.uri = uri
        self.range = to_type(range, Range)

 
class Diagnostic(object):
     def __init__(self, range, severity, code, source, message, relatedInformation):
        """
        Constructs a new Diagnostic instance.
        :param Range range: The range at which the message applies.Resource file.
        :param int severity: The diagnostic's severity. Can be omitted. If omitted it is up to the
                                client to interpret diagnostics as error, warning, info or hint.
        :param str code: The diagnostic's code, which might appear in the user interface.
        :param str source: A human-readable string describing the source of this
                            diagnostic, e.g. 'typescript' or 'super lint'.
        :param str message: The diagnostic's message.
        :param list relatedInformation: An array of related diagnostic information, e.g. when symbol-names within   
                                        a scope collide all definitions can be marked via this property.
        """
        self.range = range
        self.severity = severity
        self.code = code
        self.source = source
        self.message = message
        self.relatedInformation = relatedInformation


class DiagnosticSeverity(object):
    Error = 1
    Warning = 2 # TODO: warning is known in python
    Information = 3
    Hint = 4


class DiagnosticRelatedInformation(object):
    def __init__(self, location, message):
        """
        Constructs a new Diagnostic instance.
        :param Location location: The location of this related diagnostic information.
        :param str message: The message of this related diagnostic information.
        """
        self.location = location
        self.message = message

 
class Command(object):
     def __init__(self, title, command, arguments):
        """
        Constructs a new Diagnostic instance.
        :param str title: Title of the command, like `save`.
        :param str command: The identifier of the actual command handler.
        :param list argusments: Arguments that the command handler should be invoked with.
        """
        self.title = title
        self.command = command
        self.arguments = arguments


class TextDocumentItem(object):
    """
    An item to transfer a text document from the client to the server.
    """
    def __init__(self, uri, languageId, version, text):
        """
        Constructs a new Diagnostic instance.
        
        :param DocumentUri uri: Title of the command, like `save`.
        :param str languageId: The identifier of the actual command handler.
        :param int version: Arguments that the command handler should be invoked with.
        :param str text: Arguments that the command handler should be invoked with.
        """
        self.uri = uri
        self.languageId = languageId
        self.version = version
        self.text = text


class TextDocumentIdentifier(object):
    """
    Text documents are identified using a URI. On the protocol level, URIs are passed as strings. 
    """
    def __init__(self, uri):
        """
        Constructs a new TextDocumentIdentifier instance.

        :param DocumentUri uri: The text document's URI.       
        """
        self.uri = uri

class TextDocumentPositionParams(object):
    """
    A parameter literal used in requests to pass a text document and a position inside that document.
    """
    def __init__(self, textDocument, position):
        """
        Constructs a new TextDocumentPositionParams instance.
        
        :param TextDocumentIdentifier textDocument: The text document.
        :param Position position: The position inside the text document.
        """
        self.textDocument = textDocument
        self.position = position


class LANGUAGE_IDENTIFIER:
    BAT="bat"
    BIBTEX="bibtex"
    CLOJURE="clojure"
    COFFESCRIPT="coffeescript"
    C="c"
    CPP="cpp"
    CSHARP="csharp"
    CSS="css"
    DIFF="diff"
    DOCKERFILE="dockerfile"
    FSHARP="fsharp"
    GIT_COMMIT="git-commit"
    GIT_REBASE="git-rebase"
    GO="go"
    GROOVY="groovy"
    HANDLEBARS="handlebars"
    HTML="html"
    INI="ini"
    JAVA="java"
    JAVASCRIPT="javascript"
    JSON="json"
    LATEX="latex"
    LESS="less"
    LUA="lua"
    MAKEFILE="makefile"
    MARKDOWN="markdown"
    OBJECTIVE_C="objective-c"
    OBJECTIVE_CPP="objective-cpp"
    Perl="perl"
    PHP="php"
    POWERSHELL="powershell"
    PUG="jade"
    PYTHON="python"
    R="r"
    RAZOR="razor"
    RUBY="ruby"
    RUST="rust"
    SASS="sass"
    SCSS="scss"
    ShaderLab="shaderlab"
    SHELL_SCRIPT="shellscript"
    SQL="sql"
    SWIFT="swift"
    TYPE_SCRIPT="typescript"
    TEX="tex"
    VB="vb"
    XML="xml"
    XSL="xsl"
    YAML="yaml"


class SymbolKind(object):
    File = 1
    Module = 2
    Namespace = 3
    Package = 4
    Class = 5
    Method = 6
    Property = 7
    Field = 8
    Constructor = 9
    Enum = 10
    Interface = 11
    Function = 12
    Variable = 13
    Constant = 14
    String = 15
    Number = 16
    Boolean = 17
    Array = 18
    Object = 19
    Key = 20
    Null = 21
    EnumMember = 22
    Struct = 23
    Event = 24
    Operator = 25
    TypeParameter = 26


class SymbolInformation(object):
    """
    Represents information about programming constructs like variables, classes, interfaces etc.
    """
    def __init__(self, name, kind, location, containerName, deprecated=False):
        """
        Constructs a new SymbolInformation instance.

        :param str name: The name of this symbol.
        :param int kind: The kind of this symbol.
        :param bool Location: The location of this symbol. The location's range is used by a tool
                                to reveal the location in the editor. If the symbol is selected in the
                                tool the range's start information is used to position the cursor. So
                                the range usually spans more then the actual symbol's name and does
                                normally include things like visibility modifiers.

                                The range doesn't have to denote a node range in the sense of a abstract
                                syntax tree. It can therefore not be used to re-construct a hierarchy of
                                the symbols.
        :param str containerName: The name of the symbol containing this symbol. This information is for
                                    user interface purposes (e.g. to render a qualifier in the user interface
                                    if necessary). It can't be used to re-infer a hierarchy for the document
                                    symbols.
        :param bool deprecated: Indicates if this symbol is deprecated.
        """
        self.name = name
        self.kind = kind
        self.deprecated = deprecated
        self.location = to_type(location, Location)
        self.containerName = containerName


class ParameterInformation(object):
    """
    Represents a parameter of a callable-signature. A parameter can
    have a label and a doc-comment.
    """
    def __init__(self, label, documentation=""):
        """
        Constructs a new ParameterInformation instance.

        :param str label: The label of this parameter. Will be shown in the UI.
        :param str documentation: The human-readable doc-comment of this parameter. Will be shown in the UI but can be omitted.
        """
        self.label = label
        self.documentation = documentation


class SignatureInformation(object):
    """
    Represents the signature of something callable. A signature
    can have a label, like a function-name, a doc-comment, and
    a set of parameters.
    """
    def __init__(self, label, documentation="", parameters=[]):
        """
        Constructs a new SignatureInformation instance.

        :param str label: The label of this signature. Will be shown in the UI.
        :param str documentation: The human-readable doc-comment of this signature. Will be shown in the UI but can be omitted.
        :param ParameterInformation[] parameters: The parameters of this signature.
        """
        self.label = label
        self.documentation = documentation
        self.parameters = [to_type(parameter, ParameterInformation) for parameter in parameters]


class SignatureHelp(object):
    """
    Signature help represents the signature of something
    callable. There can be multiple signature but only one
    active and only one active parameter.
    """
    def __init__(self, signatures, activeSignature=0, activeParameter=0):
        """
        Constructs a new SignatureHelp instance.

        :param SignatureInformation[] signatures: One or more signatures.
        :param int activeSignature:
        :param int activeParameter:
        """
        self.signatures = [to_type(signature, SignatureInformation) for signature in signatures]
        self.activeSignature = activeSignature
        self.activeParameter = activeParameter