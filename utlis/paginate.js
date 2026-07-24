const paginate = async ({
  model,
  filter = {},
  page = 1,
  limit = 10,
  sort = {},
  select = "",
}) => {
  page = Math.max(Number(page) || 1, 1);
  limit = Math.min(Math.max(Number(limit) || 10, 1), 100);

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.find(filter).select(select).sort(sort).skip(skip).limit(limit),
    model.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    page,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
    total,
    data,
  };
};

module.exports = paginate;