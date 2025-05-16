
#ifndef _ORC_CPU_H_
#define _ORC_CPU_H_

#include <orc/orc.h>
#include <orc/orclimits.h>

ORC_BEGIN_DECLS


ORC_API void orc_get_data_cache_sizes (int *level1, int *level2, int *level3);

ORC_API void orc_get_cpu_family_model_stepping (int *family, int *model, int *stepping);

ORC_API const char * orc_get_cpu_name (void);


ORC_END_DECLS

#endif

