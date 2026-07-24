const buildPagination = async ({
    model,
    filter = {},
    page = 1,
    limit = 10,
    sort = { createdAt: -1 },
    select = ""
  }) => {
    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.max(parseInt(limit) || 10, 1);
  
    const total = await model.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNumber);
  
    if (pageNumber > totalPages && totalPages !== 0) {
      return {
        data: [],
        pagination: {
          has_next: false,
          has_previous: false,
          index: pageNumber,
          limit: limitNumber
        }
      };
    }
  
    const skip = (pageNumber - 1) * limitNumber;
  
    const data = await model
      .find(filter)
      .select(select)
      .sort(sort)
      .skip(skip)
      .limit(limitNumber);
  
    return {
      data,
      pagination: {
        has_next: pageNumber < totalPages,
        has_previous: pageNumber > 1 && pageNumber <= totalPages,
        index: pageNumber,
        limit: limitNumber
      }
    };
  };
  
  module.exports = buildPagination;