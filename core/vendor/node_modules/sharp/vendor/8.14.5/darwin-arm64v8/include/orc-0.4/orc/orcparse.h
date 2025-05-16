
#ifndef __ORC_PARSE_H__
#define __ORC_PARSE_H__

#include <orc/orc.h>

ORC_BEGIN_DECLS

typedef struct _OrcParseError OrcParseError;
struct _OrcParseError {
  const char *source;
  int line_number;
  int where;
  const char *text;
};

ORC_API void orc_parse_error_freev (OrcParseError **errors);

ORC_API int orc_parse (const char *code, OrcProgram ***programs);
ORC_API int orc_parse_full (const char *code, OrcProgram ***programs, char **log);
ORC_API int orc_parse_code (const char *code, OrcProgram ***programs, int *n_program, OrcParseError ***errors, int *n_error);
ORC_API const char * orc_parse_get_init_function (OrcProgram *program);

ORC_END_DECLS

#endif

