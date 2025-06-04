; When the type is a simple identifier:
(function_definition
  parameters: (parameters
    (typed_parameter
      type: (type
              (identifier) @type_identifier)))

  (#not-match? @type_identifier "^(str|int|float|bool|list|dict|tuple|set|frozenset|complex|bytes|bytearray|memoryview|range|slice|object|type|NoneType|List|Dict|Tuple|Set|FrozenSet|Union|Optional|Any|Callable|Iterable|Iterator|Generator|Coroutine|AsyncIterable|AsyncIterator|Awaitable|ContextManager|Pattern|Match|TypeVar|Generic|Sequence|Mapping|MutableMapping|MutableSequence|ByteString|Reversible|Sized|Container|Collection|AbstractSet|MutableSet|KeysView|ItemsView|ValuesView|Hashable|Sized|SupportsInt|SupportsFloat|SupportsComplex|SupportsBytes|SupportsAbs|SupportsRound|ChainMap|Counter|OrderedDict|defaultdict|deque|namedtuple|TypedDict)$")
)

; When the type is a generic type with one identifier
(function_definition
  parameters: (parameters
    (typed_parameter
      type: (type
              (generic_type
                (identifier) @type_identifier))))

  (#not-match? @type_identifier "^(str|int|float|bool|list|dict|tuple|set|frozenset|complex|bytes|bytearray|memoryview|range|slice|object|type|NoneType|List|Dict|Tuple|Set|FrozenSet|Union|Optional|Any|Callable|Iterable|Iterator|Generator|Coroutine|AsyncIterable|AsyncIterator|Awaitable|ContextManager|Pattern|Match|TypeVar|Generic|Sequence|Mapping|MutableMapping|MutableSequence|ByteString|Reversible|Sized|Container|Collection|AbstractSet|MutableSet|KeysView|ItemsView|ValuesView|Hashable|Sized|SupportsInt|SupportsFloat|SupportsComplex|SupportsBytes|SupportsAbs|SupportsRound|ChainMap|Counter|OrderedDict|defaultdict|deque|namedtuple|TypedDict)$")
)

; When the generic type has type parameters with one identifier
(function_definition
  parameters: (parameters
    (typed_parameter
      type: (type
              (generic_type
                (identifier)
                (type_parameter
                  (type
                    (identifier) @type_identifier))))))

  (#not-match? @type_identifier "^(str|int|float|bool|list|dict|tuple|set|frozenset|complex|bytes|bytearray|memoryview|range|slice|object|type|NoneType|List|Dict|Tuple|Set|FrozenSet|Union|Optional|Any|Callable|Iterable|Iterator|Generator|Coroutine|AsyncIterable|AsyncIterator|Awaitable|ContextManager|Pattern|Match|TypeVar|Generic|Sequence|Mapping|MutableMapping|MutableSequence|ByteString|Reversible|Sized|Container|Collection|AbstractSet|MutableSet|KeysView|ItemsView|ValuesView|Hashable|Sized|SupportsInt|SupportsFloat|SupportsComplex|SupportsBytes|SupportsAbs|SupportsRound|ChainMap|Counter|OrderedDict|defaultdict|deque|namedtuple|TypedDict)$")
)

; When the return type is a simple identifier
(function_definition
  return_type: (type
    (identifier) @type_identifier)
  (#not-match? @type_identifier "^(str|int|float|bool|list|dict|tuple|set|frozenset|complex|bytes|bytearray|memoryview|range|slice|object|type|NoneType|List|Dict|Tuple|Set|FrozenSet|Union|Optional|Any|Callable|Iterable|Iterator|Generator|Coroutine|AsyncIterable|AsyncIterator|Awaitable|ContextManager|Pattern|Match|TypeVar|Generic|Sequence|Mapping|MutableMapping|MutableSequence|ByteString|Reversible|Sized|Container|Collection|AbstractSet|MutableSet|KeysView|ItemsView|ValuesView|Hashable|Sized|SupportsInt|SupportsFloat|SupportsComplex|SupportsBytes|SupportsAbs|SupportsRound|ChainMap|Counter|OrderedDict|defaultdict|deque|namedtuple|TypedDict)$")
)

; When the return type is a generic type with one identifier
(function_definition
  return_type: (type
    (generic_type
      (identifier) @type_identifier))
  (#not-match? @type_identifier "^(str|int|float|bool|list|dict|tuple|set|frozenset|complex|bytes|bytearray|memoryview|range|slice|object|type|NoneType|List|Dict|Tuple|Set|FrozenSet|Union|Optional|Any|Callable|Iterable|Iterator|Generator|Coroutine|AsyncIterable|AsyncIterator|Awaitable|ContextManager|Pattern|Match|TypeVar|Generic|Sequence|Mapping|MutableMapping|MutableSequence|ByteString|Reversible|Sized|Container|Collection|AbstractSet|MutableSet|KeysView|ItemsView|ValuesView|Hashable|Sized|SupportsInt|SupportsFloat|SupportsComplex|SupportsBytes|SupportsAbs|SupportsRound|ChainMap|Counter|OrderedDict|defaultdict|deque|namedtuple|TypedDict)$")
)

; When the generic type has type parameters with one identifier
(function_definition
  return_type: (type
    (generic_type
      (identifier)
      (type_parameter
        (type
          (identifier) @type_identifier))))
  (#not-match? @type_identifier "^(str|int|float|bool|list|dict|tuple|set|frozenset|complex|bytes|bytearray|memoryview|range|slice|object|type|NoneType|List|Dict|Tuple|Set|FrozenSet|Union|Optional|Any|Callable|Iterable|Iterator|Generator|Coroutine|AsyncIterable|AsyncIterator|Awaitable|ContextManager|Pattern|Match|TypeVar|Generic|Sequence|Mapping|MutableMapping|MutableSequence|ByteString|Reversible|Sized|Container|Collection|AbstractSet|MutableSet|KeysView|ItemsView|ValuesView|Hashable|Sized|SupportsInt|SupportsFloat|SupportsComplex|SupportsBytes|SupportsAbs|SupportsRound|ChainMap|Counter|OrderedDict|defaultdict|deque|namedtuple|TypedDict)$")
)