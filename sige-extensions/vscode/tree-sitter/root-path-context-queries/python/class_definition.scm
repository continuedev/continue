; Match superclass identifiers in a simple inheritance
(class_definition
  superclasses: (argument_list
    (identifier) @catch)
  (#not-match? @catch "^(str|int|float|bool|list|dict|tuple|set|frozenset|complex|bytes|bytearray|memoryview|range|slice|object|type|NoneType|List|Dict|Tuple|Set|FrozenSet|Union|Optional|Any|Callable|Iterable|Iterator|Generator|Coroutine|AsyncIterable|AsyncIterator|Awaitable|ContextManager|Pattern|Match|TypeVar|Generic|Sequence|Mapping|MutableMapping|MutableSequence|ByteString|Reversible|Sized|Container|Collection|AbstractSet|MutableSet|KeysView|ItemsView|ValuesView|Hashable|Sized|SupportsInt|SupportsFloat|SupportsComplex|SupportsBytes|SupportsAbs|SupportsRound|ChainMap|Counter|OrderedDict|defaultdict|deque|namedtuple|TypedDict)$")
)

; Match the value of a keyword argument in class inheritance
(class_definition
  superclasses: (argument_list
    (keyword_argument
      (_)
      (identifier) @catch))
  (#not-match? @catch "^(str|int|float|bool|list|dict|tuple|set|frozenset|complex|bytes|bytearray|memoryview|range|slice|object|type|NoneType|List|Dict|Tuple|Set|FrozenSet|Union|Optional|Any|Callable|Iterable|Iterator|Generator|Coroutine|AsyncIterable|AsyncIterator|Awaitable|ContextManager|Pattern|Match|TypeVar|Generic|Sequence|Mapping|MutableMapping|MutableSequence|ByteString|Reversible|Sized|Container|Collection|AbstractSet|MutableSet|KeysView|ItemsView|ValuesView|Hashable|Sized|SupportsInt|SupportsFloat|SupportsComplex|SupportsBytes|SupportsAbs|SupportsRound|ChainMap|Counter|OrderedDict|defaultdict|deque|namedtuple|TypedDict)$")
)

; Match identifiers within subscripts in class inheritance
(class_definition
  superclasses: (argument_list
    (subscript
      (identifier) @catch
    ))
  (#not-match? @catch "^(str|int|float|bool|list|dict|tuple|set|frozenset|complex|bytes|bytearray|memoryview|range|slice|object|type|NoneType|List|Dict|Tuple|Set|FrozenSet|Union|Optional|Any|Callable|Iterable|Iterator|Generator|Coroutine|AsyncIterable|AsyncIterator|Awaitable|ContextManager|Pattern|Match|TypeVar|Generic|Sequence|Mapping|MutableMapping|MutableSequence|ByteString|Reversible|Sized|Container|Collection|AbstractSet|MutableSet|KeysView|ItemsView|ValuesView|Hashable|Sized|SupportsInt|SupportsFloat|SupportsComplex|SupportsBytes|SupportsAbs|SupportsRound|ChainMap|Counter|OrderedDict|defaultdict|deque|namedtuple|TypedDict)$")    
)